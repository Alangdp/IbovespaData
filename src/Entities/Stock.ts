import type { LastDividendPayment } from '../types/dividends.type.js'
import type { FinancialIndicators } from '../types/indicators.type.js'
import type { PassiveChartReturn } from '../types/PassiveChart.type.js'
import type {
  NetLiquid,
  PriceHistory,
  StockProps,
} from '../types/stock.types.js'

/** Ação montada a partir das fontes externas, com o valor de mercado calculado */
export class Stock implements StockProps {
  ticker: string
  name: string
  segment: string
  activeValue: number
  shareQuantity: number
  actualPrice: number
  marketValue: number
  /** Momento em que a instância foi criada (epoch em ms) */
  instanceTime: number = Date.now()
  priceHistory: PriceHistory[]
  lpa: number
  p_l: number
  freeFloat: number

  dividendYield: number
  grossDebt: number
  patrimony: number
  payout: number
  actualDividendYield: number
  lastDividendsYieldYear: number[]
  lastDividendsValueYear: number[]
  lastDividendsValue: LastDividendPayment[]
  indicators: FinancialIndicators

  netLiquid: NetLiquid[]
  passiveChart: PassiveChartReturn[]

  constructor(props: StockProps) {
    this.ticker = props.ticker
    this.name = props.name
    this.segment = props.segment
    this.activeValue = props.activeValue
    this.shareQuantity = props.shareQuantity
    this.actualPrice = props.actualPrice
    this.marketValue = props.actualPrice * props.activeValue
    this.priceHistory = props.priceHistory
    this.lpa = props.lpa
    this.p_l = props.p_l
    this.freeFloat = props.freeFloat

    this.dividendYield = props.dividendYield
    this.grossDebt = props.grossDebt
    this.patrimony = props.patrimony
    this.payout = props.payout
    this.actualDividendYield = props.actualDividendYield
    this.lastDividendsYieldYear = props.lastDividendsYieldYear
    this.lastDividendsValueYear = props.lastDividendsValueYear
    this.lastDividendsValue = props.lastDividendsValue
    this.indicators = props.indicators

    this.netLiquid = props.netLiquid
    this.passiveChart = props.passiveChart
  }
}
