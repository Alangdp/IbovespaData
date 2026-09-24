import { Redis } from '../global/Redis.js'
import {
  fetchDocumentoTexto,
  fetchLatestRelatorioGerencial,
} from '../sources/fnet.js'
import { extractLtvMedio } from '../utils/FiiIndicators.js'
import type { LtvRelatorio } from './FundoFetcher.js'

const LTV_PREFIX = 'FNET-LTV-'

/**
 * Validade do LTV lido do relatório gerencial: os relatórios são mensais e o
 * download do PDF no FNET é lento e instável (de 2 s a mais de 1 min)
 */
const LTV_TTL_SECONDS = 7 * 24 * 60 * 60

/** LTV médio dos fundos, lido dos relatórios gerenciais do FNET */
export class LtvDataBase {
  /** Retorna o LTV já lido do fundo, ou `null` se ainda não foi lido */
  async getCached(cnpj: string): Promise<LtvRelatorio | null> {
    return Redis.getObjectFromCache<LtvRelatorio>(`${LTV_PREFIX}${cnpj}`)
  }

  /**
   * Busca o relatório gerencial mais recente, extrai o LTV e grava no cache
   * (mesmo sem LTV encontrado ou sem relatório, para não consultar o FNET de
   * novo a cada requisição)
   *
   * @returns O LTV lido (`ltv: null` se não foi encontrado ou se o fundo não
   * publicou relatório)
   * @throws Error se o FNET falhar (quem chama decide se tenta de novo)
   */
  async load(cnpj: string): Promise<LtvRelatorio> {
    // Busca o relatório mais recente
    const documento = await fetchLatestRelatorioGerencial(cnpj)
    // Se o fundo não publicou relatório gerencial, grava o marcador sem LTV
    if (!documento) {
      const semRelatorio: LtvRelatorio = { ltv: null, referencia: '' }
      await Redis.saveObjectToCache(
        `${LTV_PREFIX}${cnpj}`,
        semRelatorio,
        LTV_TTL_SECONDS,
      )
      return semRelatorio
    }

    // Extrai o LTV do texto do PDF e grava no cache
    const texto = await fetchDocumentoTexto(documento.id)
    const ltv: LtvRelatorio = {
      ltv: extractLtvMedio(texto),
      referencia: documento.dataReferencia,
    }
    await Redis.saveObjectToCache(`${LTV_PREFIX}${cnpj}`, ltv, LTV_TTL_SECONDS)
    return ltv
  }
}
