import { Fundo } from '../Entities/Fundo.js'
import { CustomError } from '../errors/CustomError.js'
import {
  BrapiDividendEvent,
  BrapiFiiIndicator,
  BrapiHistoricalFii,
  BrapiPropertiesFii,
  BrapiReport,
} from '../types/Brapi.type.js'
import { FundoProps } from '../types/fundo.types.js'
import FundoUtils from '../utils/FundoUtils.js'
import { Brapi } from './BrapiClient.js'

// Monta um FundoProps a partir dos pedaços já buscados na brapi.
// Campos que a brapi não expõe (ltv_medio, spread_credito) ou que são
// julgamento qualitativo e não fato bruto de mercado (diversificado,
// gestora_confiavel, boa_localizacao, limite_distribuicao_respeitado,
// dividendo_extraordinario_ultimo_ano) ficam null — o schema já os define
// como opcionais com default null, então nenhum fica "inventado".
function buildFundoProps(params: {
  symbol: string
  indicator: BrapiFiiIndicator
  properties?: BrapiPropertiesFii
  report?: BrapiReport
  dividends: BrapiDividendEvent[]
  historical?: BrapiHistoricalFii
}): FundoProps {
  const { symbol, indicator, properties, report, dividends, historical } =
    params

  const segmento = FundoUtils.mapSegmento(indicator.segmentType)
  if (!segmento) {
    throw new CustomError(
      `Segmento não reconhecido para ${symbol}: ${String(indicator.segmentType)}`,
      502,
    )
  }

  const dividendosMensais = dividends
    .slice(-12)
    .map((dividend) => FundoUtils.round(dividend.rate, 4))

  return {
    ticker: symbol,
    nome: indicator.name,
    gestora: indicator.administratorName ?? null,
    segmento,
    subsegmento: indicator.segmentoAtuacao ?? '',
    descricao: FundoUtils.buildDescricao({
      nome: indicator.name,
      segmento,
      subsegmento: indicator.segmentoAtuacao,
      gestora: indicator.administratorName ?? null,
      mandate: indicator.mandate,
    }),
    cotacao: indicator.price ?? null,
    valor_patrimonial_cota: indicator.navPerShare ?? null,
    dividend_yield_12m: FundoUtils.toPercent(indicator.dividendYield12m),
    dividendos_mensais: dividendosMensais,
    taxa_administracao: FundoUtils.toPercent(
      FundoUtils.annualizeMonthlyRate(report?.adminFeeRate),
    ),
    vacancia_fisica: FundoUtils.toPercent(properties?.summary?.vacancyRate),
    liquidez_diaria: FundoUtils.computeLiquidezDiaria(
      historical?.historicalDataPrice,
    ),
    num_imoveis: properties?.summary?.count ?? null,
    diversificado: null,
    gestora_confiavel: null,
    boa_localizacao: null,
    limite_distribuicao_respeitado: null,
    dividendo_extraordinario_ultimo_ano: null,
    ltv_medio: null,
    spread_credito: null,
  }
}

export class FundoFetcher {
  // Busca um único fundo, enriquecido com todos os endpoints da brapi
  // (indicadores, imóveis/vacância, relatório mensal, dividendos e histórico
  // de preço para liquidez). Usado por GET /fundos/:ticker e por GET /fundos
  // quando `tickers` é informado.
  static async execute(ticker: string): Promise<Fundo> {
    const symbol = ticker.trim().toUpperCase()

    const [
      indicatorsRes,
      propertiesRes,
      reportsRes,
      dividendsRes,
      historicalRes,
    ] = await Promise.all([
      Brapi.indicators([symbol]),
      Brapi.properties([symbol]),
      Brapi.reports([symbol]),
      Brapi.dividends([symbol]),
      Brapi.historical([symbol]),
    ])

    const indicator = indicatorsRes?.fiis?.find((fii) => fii.symbol === symbol)
    if (!indicator) {
      throw new CustomError(`Ticker não encontrado: ${symbol}`, 404)
    }

    const properties = propertiesRes?.fiis?.find((fii) => fii.symbol === symbol)
    const report = reportsRes?.reports?.find((r) => r.symbol === symbol)
    const dividends = (dividendsRes?.dividends ?? [])
      .filter((dividend) => dividend.symbol === symbol)
      .sort((a, b) => dateOf(a) - dateOf(b))
    const historical = historicalRes?.fiis?.find((fii) => fii.symbol === symbol)

    return new Fundo(
      buildFundoProps({
        symbol,
        indicator,
        properties,
        report,
        dividends,
        historical,
      }),
    )
  }

  // Listagem "enxuta" usada quando GET /fundos é chamado sem `tickers`
  // (todos os fundos disponíveis). Usa só /api/v2/fii/list — chamar os
  // outros 4 endpoints para os ~1500+ FIIs listados na B3 não é viável numa
  // única requisição. Por isso, nesse modo, dividendos_mensais,
  // taxa_administracao, vacancia_fisica, liquidez_diaria e num_imoveis
  // sempre voltam vazios/null; para tê-los preenchidos, consulte
  // GET /fundos/{ticker} ou GET /fundos?tickers=... (até 20 por vez).
  static async executeAll(): Promise<Fundo[]> {
    const list = await Brapi.list({ limit: 10000 })
    if (!list) return []

    return list.fiis
      .filter(
        (item) =>
          FundoUtils.mapSegmento(item.segmentType) !== null && item.name,
      )
      .map(
        (item) =>
          new Fundo(
            buildFundoProps({
              symbol: item.symbol,
              indicator: item,
              dividends: [],
            }),
          ),
      )
  }
}

function dateOf(dividend: BrapiDividendEvent): number {
  const raw = dividend.paymentDate ?? dividend.exDate
  return raw ? new Date(raw).getTime() : 0
}
