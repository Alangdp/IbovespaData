import { CustomError } from '../errors/CustomError.js'
import {
  fetchFiiDividends,
  fetchFiiList,
  fetchFiiPage,
  parseFiiPage,
} from '../sources/statusinvest/index.js'
import type { CvmFundo } from '../types/cvm.type.js'
import type {
  FiiDividend,
  FiiListItem,
  FiiPageInfo,
} from '../types/fii.type.js'
import type { Fundo, Segmento } from '../types/fundo.types.js'
import FiiIndicators from '../utils/FiiIndicators.js'
import FiiQualidade from '../utils/FiiQualidade.js'
import FundoUtils from '../utils/FundoUtils.js'

/** Quantidade de meses em `dividendos_mensais` */
const MONTHS = 12

/** LTV médio e spread de crédito lidos do relatório gerencial */
export interface LtvRelatorio {
  ltv: number | null
  /** Spread de crédito médio da carteira (ex.: "1,48%") */
  spread: string | null
  /** Data de referência do relatório (dd/mm/aaaa) */
  referencia: string
}

/** Dados só buscados no detalhe do fundo */
interface FundoDetail {
  page: FiiPageInfo
  dividends: FiiDividend[]
  cvm: CvmFundo | null
  ltv: LtvRelatorio | null
  gestoraConfiavel: boolean | null
}

/**
 * Buscas em outras fontes, injetadas para o fetcher não depender do Redis
 * (e os testes rodarem offline)
 */
export interface FundoLookups {
  /** Busca os dados na base da CVM pelo CNPJ da página ou pelo ticker */
  findCvm?: (cnpj: string | null, ticker: string) => Promise<CvmFundo | null>
  /** Busca o LTV médio já lido do relatório gerencial mais recente */
  findLtv?: (cnpj: string, ticker: string) => Promise<LtvRelatorio | null>
  /** Verifica se a gestora (CNPJ) está na lista de confiáveis */
  isGestoraConfiavel?: (cnpj: string | null) => boolean | null
}

/** Segmentos com carteira de CRIs, onde o LTV médio e o spread fazem sentido */
const LTV_SEGMENTOS: Segmento[] = ['Papel', 'Híbrido']

/**
 * Monta o Fundo a partir da listagem do statusinvest e, no detalhe, da
 * página, dos proventos, dos informes da CVM e do relatório gerencial
 *
 * Sem o detalhe (resumo da listagem), os campos que dependem dessas fontes
 * ficam null — o schema já os define como opcionais com default null
 */
function buildFundo(
  item: FiiListItem,
  segmento: Segmento,
  detail?: FundoDetail,
): Fundo {
  const administradora = detail?.page.administradora ?? null
  const imoveis = detail?.page.imoveis ?? null
  const cvm = detail?.cvm ?? null
  const limite = FiiIndicators.limiteDistribuicao(cvm)

  // Carrega os rendimentos dos últimos meses (sem amortizações)
  const dividendosMensais = (detail?.dividends ?? [])
    .filter((dividend) => dividend.tipo === 'Rendimento')
    .slice(-MONTHS)
    .map((dividend) => FundoUtils.round(dividend.valor, 4))

  // Calcula o yield do último rendimento
  const dividendYield1m =
    item.lastdividend !== undefined && item.price > 0
      ? FundoUtils.round((item.lastdividend / item.price) * 100, 4)
      : null

  return {
    ticker: item.ticker,
    nome: item.companyname,
    gestora: cvm?.gestora?.nome ?? null,
    segmento,
    subsegmento: item.segment,
    descricao: FundoUtils.buildDescricao({
      nome: item.companyname,
      segmento,
      subsegmento: item.segment,
      administradora,
    }),
    cotacao: item.price ?? null,
    valor_patrimonial_cota: item.valorpatrimonialcota ?? null,
    dividend_yield_12m: FundoUtils.roundOrNull(item.dy, 4),
    dividendos_mensais: dividendosMensais,
    taxa_administracao: FiiIndicators.taxaAdministracao(cvm),
    vacancia_fisica: FundoUtils.computeVacancia(imoveis),
    liquidez_diaria: FundoUtils.roundOrNull(item.liquidezmediadiaria),
    num_imoveis: imoveis ? imoveis.length : null,
    diversificado: FiiQualidade.diversificacao(segmento, cvm).diversificado,
    gestora_confiavel: detail?.gestoraConfiavel ?? null,
    boa_localizacao: FiiQualidade.localizacao(segmento, cvm).boa_localizacao,
    limite_distribuicao_respeitado: limite.respeitado,
    dividendo_extraordinario_ultimo_ano: detail
      ? FiiIndicators.dividendoExtraordinario(detail.dividends)
      : null,
    ltv_medio: detail?.ltv?.ltv ?? null,
    spread_credito: detail?.ltv?.spread ?? null,

    // Campos extras, fora do contrato original
    administradora,
    gestora_cnpj: cvm?.gestora?.cnpj || null,
    percentual_distribuido: limite.percentual_distribuido,
    alavancagem: FiiIndicators.alavancagem(cvm),
    ltv_referencia: detail?.ltv?.ltv != null ? detail.ltv.referencia : null,
    cnpj: detail?.page.cnpj ?? cvm?.cnpj ?? null,
    tipo_gestao: item.gestao_f && item.gestao_f !== '-' ? item.gestao_f : null,
    p_vp: FundoUtils.roundOrNull(item.p_vp, 4),
    dividend_yield_1m: dividendYield1m,
    ultimo_rendimento: item.lastdividend ?? null,
    dividend_cagr_3a: FundoUtils.roundOrNull(item.dividend_cagr, 4),
    cota_cagr_3a: FundoUtils.roundOrNull(item.cota_cagr, 4),
    percentual_caixa: FundoUtils.roundOrNull(item.percentualcaixa, 4),
    numero_cotistas: item.numerocotistas ?? null,
    cotas_emitidas: item.numerocotas ?? null,
    patrimonio_liquido: item.patrimonio ?? null,
    valor_mercado:
      item.numerocotas === undefined
        ? null
        : FundoUtils.round(item.price * item.numerocotas),
    area_total: FundoUtils.computeAreaTotal(imoveis),
  }
}

/** Busca fundos imobiliários no statusinvest */
export class FundoFetcher {
  /**
   * Busca a listagem de todos os FIIs
   *
   * @throws CustomError 502 se o statusinvest não responder
   */
  static async fetchList(): Promise<FiiListItem[]> {
    const list = await fetchFiiList()
    // Se o statusinvest falhou
    if (!list) {
      throw new CustomError('Erro ao buscar a lista de FIIs', 502)
    }
    return list
  }

  /**
   * Monta o resumo do fundo só com os dados da listagem
   *
   * Nesse modo dividendos_mensais, vacancia_fisica, num_imoveis, cnpj,
   * administradora e area_total voltam vazios/null
   *
   * @returns `null` se o fundo não for de um segmento do contrato
   */
  static buildSummary(item: FiiListItem): Fundo | null {
    const segmento = FundoUtils.mapSegmento(item)
    // Se o segmento está fora do contrato
    if (!segmento) {
      return null
    }
    return buildFundo(item, segmento)
  }

  /**
   * Monta o fundo completo, buscando a página, os proventos e, com as
   * buscas informadas, os dados da CVM, o LTV e o spread do relatório
   * gerencial e a lista de gestoras confiáveis
   *
   * @throws CustomError 422 se o fundo não for de um segmento do contrato
   */
  static async buildDetail(
    item: FiiListItem,
    { findCvm, findLtv, isGestoraConfiavel }: FundoLookups = {},
  ): Promise<Fundo> {
    const segmento = FundoUtils.mapSegmento(item)
    // Se o segmento está fora do contrato
    if (!segmento) {
      throw new CustomError(
        `Segmento não suportado para ${item.ticker}: ${item.sectorname}`,
        422,
      )
    }

    // Busca a página e os proventos do fundo
    const html = await fetchFiiPage(item.ticker)
    const dividends = await fetchFiiDividends(item.ticker)

    const page = parseFiiPage(html)

    // Busca os dados da CVM do fundo
    const cvm = findCvm ? await findCvm(page.cnpj, item.ticker) : null

    // Busca o LTV médio e o spread só para fundos com carteira de CRIs
    const cnpj = page.cnpj ?? cvm?.cnpj ?? null
    const ltv =
      findLtv && cnpj && LTV_SEGMENTOS.includes(segmento)
        ? await findLtv(cnpj, item.ticker)
        : null

    return buildFundo(item, segmento, {
      page,
      dividends: dividends ?? [],
      cvm,
      ltv,
      gestoraConfiavel: isGestoraConfiavel
        ? isGestoraConfiavel(cvm?.gestora?.cnpj || null)
        : null,
    })
  }
}
