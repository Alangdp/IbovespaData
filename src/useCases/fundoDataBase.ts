import { CustomError } from '../errors/CustomError.js'
import { LTV_JOB, ltvQueue } from '../global/Queue.js'
import { Redis } from '../global/Redis.js'
import { cnpjDigits } from '../sources/cvm/build.js'
import type { CvmGestora, CvmRegiao } from '../types/cvm.type.js'
import type { FiiListItem } from '../types/fii.type.js'
import type { Fundo } from '../types/fundo.types.js'
import { normalizeNome } from '../utils/Cidades.js'
import FiiIndicators, { type TaxaTrimestre } from '../utils/FiiIndicators.js'
import FiiQualidade, {
  type Diversificacao,
  type Localizacao,
} from '../utils/FiiQualidade.js'
import { CvmDataBase } from './cvmDataBase.js'
import { FundoFetcher, type FundoLookups } from './FundoFetcher.js'
import { isGestoraConfiavel } from './gestorasConfiaveis.js'
import { LtvDataBase } from './ltvDataBase.js'

/**
 * Versão do formato do Fundo no cache: aumente quando mudar os campos, para o
 * cache antigo (sem os campos novos) deixar de ser usado
 */
const CACHE_VERSION = 5
const CACHE_PREFIX = `FUNDO-v${CACHE_VERSION}-`
const LIST_CACHE_KEY = 'FUNDOS-LISTA'

/**
 * Validade do cache: indicadores de FII fecham 1x/dia após o pregão; 6h é
 * uma folga confortável sem deixar o dado velho demais durante o dia
 */
const DEFAULT_TTL_SECONDS = 6 * 60 * 60

const cvmDataBase = new CvmDataBase()
const ltvDataBase = new LtvDataBase()

/** Chave do cache do detalhe do fundo */
export function fundoCacheKey(ticker: string): string {
  return `${CACHE_PREFIX}${ticker.trim().toUpperCase()}`
}

const lookups: FundoLookups = {
  // Busca na base da CVM pelo CNPJ da página ou, na falta dele, pelo ticker
  findCvm: async (cnpj, ticker) =>
    (cnpj ? await cvmDataBase.getByCnpj(cnpj) : null) ??
    (await cvmDataBase.getByTicker(ticker)),

  isGestoraConfiavel,

  // Retorna o LTV já lido; se ainda não foi, enfileira a leitura (o job
  // invalida o cache do fundo ao terminar) e segue sem ele
  findLtv: async (cnpj, ticker) => {
    const cached = await ltvDataBase.getCached(cnpj)
    // Se o LTV ainda não foi lido
    if (!cached) {
      await ltvQueue
        .add(LTV_JOB, { cnpj, ticker }, { jobId: `ltv-${cnpj}` })
        .catch((error) => {
          console.error('[ltvQueue] erro ao enfileirar:', error.message)
        })
    }
    return cached
  },
}

/** Detalhe do cálculo da taxa de administração */
export interface FundoTaxas {
  ticker: string
  cnpj: string | null
  /** % ao ano, média dos trimestres anualizados */
  taxa_administracao: number | null
  /** Do mais antigo ao mais recente */
  trimestres: TaxaTrimestre[]
}

/** Detalhe dos critérios de qualidade do fundo */
export interface FundoCriterios {
  ticker: string
  cnpj: string | null
  segmento: Fundo['segmento']
  diversificacao: Diversificacao
  localizacao: Localizacao
  gestora: {
    nome: string | null
    cnpj: string | null
    confiavel: boolean | null
  }
}

/** Gestora de FII com a marcação da lista de confiáveis */
export interface GestoraListada extends CvmGestora {
  confiavel: boolean | null
}

/** Filtros da classificação de cidades */
export interface RegioesFiltro {
  tipo?: string
  uf?: string
  cidade?: string
}

/** Acesso aos fundos, com cache no Redis */
export class FundoDataBase {
  /**
   * Retorna a listagem bruta de FIIs do cache ou, se não estiver lá, busca e
   * grava (chave `FUNDOS-LISTA`)
   */
  private async getList(): Promise<FiiListItem[]> {
    // Busca a listagem no cache
    const cached = await Redis.getObjectFromCache<FiiListItem[]>(LIST_CACHE_KEY)
    // Se a listagem está no cache
    if (cached) {
      return cached
    }

    // Busca a listagem no statusinvest e grava no cache
    const list = await FundoFetcher.fetchList()
    await Redis.saveObjectToCache(LIST_CACHE_KEY, list, DEFAULT_TTL_SECONDS)
    return list
  }

  /**
   * Retorna o fundo completo do cache ou, se não estiver lá, busca e grava
   * (chave `FUNDO-v<versão>-<ticker>`)
   *
   * @throws CustomError 404 se o ticker não for um FII listado
   * @throws CustomError 422 se o fundo for de um segmento fora do contrato
   */
  async getFundo(ticker: string): Promise<Fundo> {
    const symbol = ticker.trim().toUpperCase()

    // Busca o fundo no cache (a validade é o TTL da chave; o objeto é
    // gravado exatamente como o contrato, sem campos de controle)
    const cached = await Redis.getObjectFromCache<Fundo>(fundoCacheKey(symbol))
    // Se o fundo está no cache
    if (cached) {
      return cached
    }

    // Valida o ticker pela listagem (a página responde até para ticker
    // inexistente)
    const item = (await this.getList()).find((fii) => fii.ticker === symbol)
    // Se o ticker não é um FII listado
    if (!item) {
      throw new CustomError(`Ticker não encontrado: ${symbol}`, 404)
    }

    // Monta o fundo completo e grava no cache
    const fundo = await FundoFetcher.buildDetail(item, lookups)
    await Redis.saveObjectToCache(
      fundoCacheKey(symbol),
      fundo,
      DEFAULT_TTL_SECONDS,
    )

    return fundo
  }

  /**
   * Retorna o cálculo da taxa de administração, trimestre a trimestre
   *
   * @throws CustomError 404 se o ticker não for um FII listado
   */
  async getTaxas(ticker: string): Promise<FundoTaxas> {
    const symbol = ticker.trim().toUpperCase()

    // Busca o fundo na CVM pelo ticker; sem ele no índice, usa o CNPJ do
    // detalhe (que também valida se o ticker existe)
    let cvm = await cvmDataBase.getByTicker(symbol)
    if (!cvm) {
      const fundo = await this.getFundo(symbol)
      cvm = fundo.cnpj ? await cvmDataBase.getByCnpj(fundo.cnpj) : null
    }

    return {
      ticker: symbol,
      cnpj: cvm?.cnpj ?? null,
      taxa_administracao: FiiIndicators.taxaAdministracao(cvm),
      trimestres: cvm ? FiiIndicators.taxaPorTrimestre(cvm) : [],
    }
  }

  /**
   * Retorna o cálculo de diversificado, boa_localizacao e gestora_confiavel
   *
   * @throws CustomError 404 se o ticker não for um FII listado
   * @throws CustomError 422 se o fundo for de um segmento fora do contrato
   */
  async getCriterios(ticker: string): Promise<FundoCriterios> {
    // Busca o fundo (valida o ticker e traz o segmento e o CNPJ) e os
    // informes da CVM
    const fundo = await this.getFundo(ticker)
    const cvm =
      (fundo.cnpj ? await cvmDataBase.getByCnpj(fundo.cnpj) : null) ??
      (await cvmDataBase.getByTicker(fundo.ticker))
    const gestoraCnpj = cvm?.gestora?.cnpj || null

    return {
      ticker: fundo.ticker,
      cnpj: cvm?.cnpj ?? fundo.cnpj,
      segmento: fundo.segmento,
      diversificacao: FiiQualidade.diversificacao(fundo.segmento, cvm),
      localizacao: FiiQualidade.localizacao(fundo.segmento, cvm),
      gestora: {
        nome: cvm?.gestora?.nome ?? null,
        cnpj: gestoraCnpj,
        confiavel: isGestoraConfiavel(gestoraCnpj),
      },
    }
  }

  /**
   * Retorna a classificação das cidades por tipo de imóvel
   *
   * Os filtros ignoram maiúsculas e acentos; `cidade` aceita parte do nome
   */
  async getRegioes(filtro: RegioesFiltro = {}): Promise<CvmRegiao[]> {
    const tipo = filtro.tipo ? normalizeNome(filtro.tipo) : null
    const uf = filtro.uf ? normalizeNome(filtro.uf) : null
    const cidade = filtro.cidade ? normalizeNome(filtro.cidade) : null

    return (await cvmDataBase.getRegioes()).filter(
      (regiao) =>
        (!tipo || normalizeNome(regiao.tipo) === tipo) &&
        (!uf || regiao.uf === uf) &&
        (!cidade || normalizeNome(regiao.cidade).includes(cidade)),
    )
  }

  /**
   * Retorna as gestoras de FII com a marcação da lista de confiáveis
   *
   * @param busca - Parte do nome ou do CNPJ (ignora maiúsculas e acentos)
   */
  async getGestoras(busca?: string): Promise<GestoraListada[]> {
    const termo = busca ? normalizeNome(busca) : null
    const digitos = busca ? cnpjDigits(busca) : ''

    return (await cvmDataBase.getGestoras())
      .filter(
        (gestora) =>
          !termo ||
          normalizeNome(gestora.nome).includes(termo) ||
          (digitos.length > 0 && gestora.cnpj.includes(digitos)),
      )
      .map((gestora) => ({
        ...gestora,
        confiavel: isGestoraConfiavel(gestora.cnpj),
      }))
  }

  /**
   * Retorna vários fundos
   *
   * Sem `tickers`, retorna o resumo de todos os fundos dos segmentos do
   * contrato (ver `FundoFetcher.buildSummary`). Com `tickers`, busca cada
   * fundo completo via `getFundo`; tickers inválidos ou sem dado na fonte são
   * apenas omitidos do retorno
   */
  async getFundos(tickers?: string[]): Promise<Fundo[]> {
    // Se nenhum ticker foi informado
    if (!tickers || tickers.length === 0) {
      const list = await this.getList()
      return list
        .map((item) => FundoFetcher.buildSummary(item))
        .filter((fundo): fundo is Fundo => fundo !== null)
    }

    // Carrega os tickers sem repetição
    const uniqueTickers = Array.from(
      new Set(
        tickers
          .map((ticker) => ticker.trim().toUpperCase())
          .filter((ticker) => ticker.length > 0),
      ),
    )

    // Busca os fundos em sequência, descartando os que falharem (em paralelo
    // aumentaria a chance de bloqueio 403 do statusinvest)
    const fundos: Fundo[] = []
    for (const ticker of uniqueTickers) {
      try {
        fundos.push(await this.getFundo(ticker))
      } catch {
        // Ignora o ticker inválido
      }
    }
    return fundos
  }
}
