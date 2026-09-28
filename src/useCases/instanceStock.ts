import { Stock } from '../Entities/Stock'
import {
  fetchCashFlow,
  fetchDividends,
  fetchIndicators,
  fetchPassiveChart,
  fetchPayout,
  fetchPrices,
  fetchStockPage,
  parseBasicInfo,
} from '../sources/statusinvest'
import type { CashFlowYear } from '../types/cashFlow.type'
import type { NetLiquid } from '../types/stock.types'

/** Quantidade máxima de anos guardada nos históricos de dividendos */
const MAX_YEARS = 10

/**
 * Monta a ação consultando todas as fontes do statusinvest
 *
 * As consultas rodam em sequência de propósito: paralelizar aumentaria a
 * pressão sobre o statusinvest, que já bloqueia com 403
 *
 * @param ticker - Código da ação (ex.: PETR4)
 * @throws Error se a página, os indicadores ou algum dado obrigatório falhar
 */
export async function instanceStock(ticker: string): Promise<Stock> {
  // Busca a página primeiro: ticker inválido (404) ou bloqueio (403) falham
  // aqui, antes de qualquer outra consulta
  const html = await fetchStockPage(ticker)
  const basicInfo = parseBasicInfo(html, ticker)

  // Busca os demais dados da ação
  const priceHistory = await fetchPrices(ticker)
  const dividendInfo = await fetchDividends(ticker)
  const payout = await fetchPayout(ticker)
  const indicators = await fetchIndicators(ticker)
  const cashFlow = await fetchCashFlow(ticker)
  const passiveChart = await fetchPassiveChart(ticker)

  // Valida os dados obrigatórios
  if (!priceHistory) {
    throw new Error('Error getting price history')
  }
  if (!payout) {
    throw new Error('Error getting payout')
  }
  if (!dividendInfo) {
    throw new Error('Error getting dividend info')
  }
  if (!passiveChart) {
    throw new Error('Error getting passive chart')
  }

  // Carrega os últimos dividend yields anuais (o mais recente primeiro)
  const lastDividendsYield = indicators.dy.olds
    .slice(0, MAX_YEARS)
    .map((dividend) => Number(dividend.value))

  // Carrega os últimos totais de dividendos por ano (o mais recente primeiro)
  const lastDividendsPerYear = dividendInfo.lastDividendPaymentsYear
    .toReversed()
    .slice(0, MAX_YEARS)
    .map((dividend) => dividend.value)

  // Instancia a ação
  return new Stock({
    ticker: basicInfo.ticker,
    name: basicInfo.name,
    segment: basicInfo.segment,
    freeFloat: basicInfo.freeFloat,
    grossDebt: basicInfo.grossDebt,
    indicators,
    activeValue: basicInfo.VPA * basicInfo.shareQuantity,
    actualPrice: basicInfo.price,
    priceHistory: priceHistory.priceVariation,
    shareQuantity: basicInfo.shareQuantity,
    dividendYield: basicInfo.dividendPorcent,
    patrimony: basicInfo.liquidPatrimony,
    payout: payout.average / 100,
    actualDividendYield: lastDividendsYield[0] / 100,
    lastDividendsYieldYear: lastDividendsYield,
    lastDividendsValueYear: lastDividendsPerYear,
    lastDividendsValue: dividendInfo.lastDividendPayments,
    netLiquid: toNetLiquid(cashFlow),
    passiveChart,
    lpa: basicInfo.LPA,
    p_l: indicators.p_l.actual,
  })
}

/**
 * Extrai o lucro líquido de cada ano do fluxo de caixa, do mais recente ao
 * mais antigo
 *
 * Anos sem lucro informado (ausente ou zero) são descartados
 */
function toNetLiquid(cashFlow: CashFlowYear[] | null): NetLiquid[] {
  // Se o fluxo de caixa não foi carregado
  if (!cashFlow) {
    return []
  }

  return cashFlow
    .map((year) => ({
      year: year.name,
      value: year.value.LucroLiquidoExercicioConsolidado,
    }))
    .filter((netLiquid) => netLiquid.value)
}
