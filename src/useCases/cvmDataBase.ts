import { Redis } from '../global/Redis.js'
import {
  buildCvmFundos,
  CVM_FILES,
  type CvmCsvs,
  cnpjDigits,
} from '../sources/cvm/build.js'
import {
  type CvmInforme,
  fetchCvmCsvs,
  fetchCvmEtag,
} from '../sources/cvm/download.js'
import { classificarRegioes, listarGestoras } from '../sources/cvm/regioes.js'
import { fetchMunicipios, type Municipio } from '../sources/ibge.js'
import { fetchFiiList } from '../sources/statusinvest/index.js'
import type { CvmFundo, CvmGestora, CvmRegiao } from '../types/cvm.type.js'
import { CidadeResolver } from '../utils/Cidades.js'

const FUNDO_PREFIX = 'CVM-FII-'
const ISIN_PREFIX = 'CVM-ISIN-'
const ETAGS_KEY = 'CVM-ETAGS'
const REGIOES_KEY = 'CVM-REGIOES'
const GESTORAS_KEY = 'CVM-GESTORAS'
const MUNICIPIOS_KEY = 'IBGE-MUNICIPIOS'

/**
 * Validade das chaves: bem acima do intervalo do job (diário), para os dados
 * continuarem disponíveis se a CVM ficar fora do ar por alguns dias
 */
const TTL_SECONDS = 30 * 24 * 60 * 60

/** Municípios do IBGE mudam raramente (censo, criação de município) */
const MUNICIPIOS_TTL_SECONDS = 90 * 24 * 60 * 60

const INFORMES = Object.keys(CVM_FILES) as CvmInforme[]

/**
 * Versão do formato do registro gravado: aumente ao mudar `CvmFundo` ou os
 * CSVs lidos, para a próxima execução refazer a base mesmo sem mudança na CVM
 */
const DATA_VERSION = 3

/** Resultado de uma atualização da base */
export interface CvmRefreshResult {
  atualizado: boolean
  fundos: number
}

/** Dados dos FIIs vindos dos informes da CVM, guardados no Redis */
export class CvmDataBase {
  /**
   * Atualiza a base a partir dos zips da CVM do ano atual e do anterior
   *
   * Só baixa os arquivos quando algum ETag mudou (a CVM republica em geral
   * uma vez por semana) ou quando a base não existe no Redis
   *
   * @param force - Baixa mesmo sem mudança de ETag
   */
  async refresh(force = false): Promise<CvmRefreshResult> {
    const year = new Date().getFullYear()
    const years = [year - 1, year]

    // Busca os ETags atuais de cada arquivo
    const etags: Record<string, string | number | null> = {
      versao: DATA_VERSION,
    }
    for (const informe of INFORMES) {
      for (const y of years) {
        etags[`${informe}-${y}`] = await fetchCvmEtag(informe, y)
      }
    }

    // Se nada mudou desde a última carga
    const saved =
      await Redis.getObjectFromCache<Record<string, string | number>>(ETAGS_KEY)
    if (!force && saved && JSON.stringify(saved) === JSON.stringify(etags)) {
      return { atualizado: false, fundos: 0 }
    }

    // Baixa os CSVs de todos os informes e anos
    const csvs: CvmCsvs = {}
    for (const informe of INFORMES) {
      for (const y of years) {
        // Se o arquivo do ano não existe
        if (etags[`${informe}-${y}`] === null) {
          continue
        }
        const files = await fetchCvmCsvs(informe, y, [...CVM_FILES[informe]])
        for (const [file, text] of Object.entries(files)) {
          csvs[file] = [...(csvs[file] ?? []), text]
        }
      }
    }

    // Consolida um registro por fundo, com a cidade de cada imóvel e a
    // classificação das cidades
    const municipios = await this.getMunicipios()
    const resolver = new CidadeResolver(municipios)
    const fundos = buildCvmFundos(csvs, (endereco) =>
      resolver.resolve(endereco),
    )
    const segmentos = await this.getSegmentosStatusinvest()
    const regioes = classificarRegioes(fundos.values(), municipios, (fundo) =>
      fundo.isin ? (segmentos.get(fundo.isin.slice(2, 6)) ?? null) : null,
    )

    // Grava tudo, com o índice por ISIN, as regiões e as gestoras
    const entries: [string, unknown][] = [
      [REGIOES_KEY, regioes],
      [GESTORAS_KEY, listarGestoras(fundos.values())],
    ]
    for (const fundo of fundos.values()) {
      entries.push([`${FUNDO_PREFIX}${fundo.cnpj}`, fundo])
      if (fundo.isin) {
        entries.push([`${ISIN_PREFIX}${fundo.isin.slice(2, 6)}`, fundo.cnpj])
      }
    }
    await Redis.saveObjectsToCache(entries, TTL_SECONDS)

    // Grava os ETags por último: se algo falhar antes (inclusive o IBGE), a
    // próxima execução baixa tudo de novo
    if (municipios.length > 0) {
      await Redis.saveObjectToCache(ETAGS_KEY, etags, TTL_SECONDS)
    }

    return { atualizado: true, fundos: fundos.size }
  }

  /**
   * Retorna os municípios do IBGE do cache ou, se não estiverem lá, busca e
   * grava
   *
   * Se o IBGE falhar, segue sem municípios: os imóveis ficam sem cidade e a
   * boa_localizacao fica null até a próxima carga
   */
  private async getMunicipios(): Promise<Municipio[]> {
    const cached = await Redis.getObjectFromCache<Municipio[]>(MUNICIPIOS_KEY)
    // Se os municípios estão no cache
    if (cached) {
      return cached
    }

    try {
      const municipios = await fetchMunicipios()
      await Redis.saveObjectToCache(
        MUNICIPIOS_KEY,
        municipios,
        MUNICIPIOS_TTL_SECONDS,
      )
      return municipios
    } catch (error) {
      console.error(
        '[cvm] erro ao buscar os municípios do IBGE:',
        (error as Error).message,
      )
      return []
    }
  }

  /**
   * Busca o segmento de cada FII no statusinvest, pelo código do ticker
   * (GGRC11 → GGRC, o mesmo trecho do ISIN)
   *
   * Se o statusinvest falhar, segue sem: o tipo de imóvel vem só da CVM
   */
  private async getSegmentosStatusinvest(): Promise<Map<string, string>> {
    const list = await fetchFiiList().catch(() => null)
    // Se o statusinvest falhou
    if (!list) {
      console.error('[cvm] statusinvest indisponível: tipos só pela CVM')
      return new Map()
    }
    return new Map(list.map((item) => [item.ticker.slice(0, 4), item.segment]))
  }

  /** Retorna a classificação das cidades por tipo de imóvel */
  async getRegioes(): Promise<CvmRegiao[]> {
    return (await Redis.getObjectFromCache<CvmRegiao[]>(REGIOES_KEY)) ?? []
  }

  /** Retorna as gestoras de FII, da que gere mais fundos para a que gere menos */
  async getGestoras(): Promise<CvmGestora[]> {
    return (await Redis.getObjectFromCache<CvmGestora[]>(GESTORAS_KEY)) ?? []
  }

  /** Retorna o fundo pelo CNPJ (com ou sem pontuação) */
  async getByCnpj(cnpj: string): Promise<CvmFundo | null> {
    return Redis.getObjectFromCache<CvmFundo>(
      `${FUNDO_PREFIX}${cnpjDigits(cnpj)}`,
    )
  }

  /**
   * Retorna o fundo pelo ticker, usando o código do ISIN (GGRC11 →
   * BR**GGRC**CTF002)
   */
  async getByTicker(ticker: string): Promise<CvmFundo | null> {
    const cnpj = await Redis.getObjectFromCache<string>(
      `${ISIN_PREFIX}${ticker.trim().toUpperCase().slice(0, 4)}`,
    )
    // Se o ticker não está no índice
    if (!cnpj) {
      return null
    }

    return this.getByCnpj(cnpj)
  }
}
