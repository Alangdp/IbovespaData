import type { LastDividendPayment } from './dividends.type'
import type { FinancialIndicators } from './indicators.type'
import type { PassiveChartReturn } from './PassiveChart.type'

/** Lucro líquido de um ano */
export type NetLiquid = {
  year: string
  value: number
}

/** Preço de fechamento em uma data (`dd/mm/aa hh:mm`) */
export interface PriceHistory {
  date: string
  price: number
}

/** Dados consolidados de uma ação, usados pelas rotas e pelas pontuações */
export interface StockProps {
  ticker: string
  name: string
  segment: string
  activeValue: number
  actualPrice: number
  priceHistory: PriceHistory[]
  shareQuantity: number
  lpa: number
  p_l: number
  freeFloat: number

  // Variáveis usadas por Bazin
  dividendYield: number
  grossDebt: number
  patrimony: number
  payout: number
  actualDividendYield: number
  lastDividendsYieldYear: number[]
  lastDividendsValueYear: number[]
  lastDividendsValue: LastDividendPayment[]
  indicators: FinancialIndicators

  // Variáveis usadas por Graham
  netLiquid: NetLiquid[]
  passiveChart: PassiveChartReturn[]
}
