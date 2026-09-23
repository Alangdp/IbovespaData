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
import type { BasicInfoReturn } from '../types/BasicInfo.type'
import type { DividendReturn } from '../types/dividends.type'
import type { Header } from '../types/get.type'
import type { FinancialIndicators } from '../types/indicators.type'
import type { PassiveChartReturn } from '../types/PassiveChart.type'
import type { PayoutReturn } from '../types/Payout.type'
import type { PriceReturn } from '../types/prices.type'
import type {
  CashFlowHeader,
  NetLiquid,
  StockProps,
} from '../types/stock.types'

type instanceStockProps = {
  priceHistory: PriceReturn | null
  payout: PayoutReturn | null
  dividendInfo: DividendReturn | null
  passiveChart: PassiveChartReturn[] | null
  basicInfo: BasicInfoReturn | null
  indicators: FinancialIndicators | null
  cashFlow: Header[] | null
}

export class InstanceStock {
  private props: instanceStockProps = {
    priceHistory: null,
    payout: null,
    dividendInfo: null,
    basicInfo: null,
    indicators: null,
    cashFlow: null,
    passiveChart: null,
  }

  private constructor(
    private readonly ticker: string,
    private readonly html: string,
  ) {}

  static async execute(ticker: string): Promise<Stock> {
    // A página é baixada primeiro: ticker inválido (404) ou bloqueio (403)
    // falham aqui, antes de qualquer outra consulta.
    const html = await fetchStockPage(ticker)
    return new InstanceStock(ticker, html).initialize()
  }

  private async initialize(): Promise<Stock> {
    await this.getData()
    this.validate(this.props)
    return new Stock(this.makeStockProps())
  }

  // As consultas rodam em sequência de propósito: paralelizar aumentaria a
  // pressão sobre o statusinvest, que já bloqueia com 403.
  private async getData() {
    const { ticker } = this

    this.props.basicInfo = parseBasicInfo(this.html, ticker)
    this.props.priceHistory = await fetchPrices(ticker)
    this.props.dividendInfo = await fetchDividends(ticker)
    this.props.payout = await fetchPayout(ticker)
    this.props.indicators = await fetchIndicators(ticker)
    this.props.cashFlow = await fetchCashFlow(ticker)
    this.props.passiveChart = await fetchPassiveChart(ticker)
  }

  private makeStockProps(): StockProps {
    const props = this.props
    const basicInfo = props.basicInfo!
    const priceHistory = props.priceHistory!
    const indicators = props.indicators!
    const payout = props.payout!
    const dividendInfo = props.dividendInfo!
    const passiveChart = props.passiveChart!

    // GET NET LIQUID

    const netLiquidArray = this.getNetLiquid()

    // GET DIVIDENDS

    const { lastDividendsPerYear, lastDividendsYield } = this.getDividends()

    const stockProp: StockProps = {
      ...basicInfo,
      indicators,
      ticker: basicInfo.ticker,
      name: basicInfo.name,
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
      netLiquid: netLiquidArray,
      passiveChart,
      lpa: basicInfo.LPA,
      p_l: 0,
    }

    return stockProp
  }

  private getNetLiquid() {
    const cashFlow = this.props.cashFlow
    // ? Lucro Líquido

    const netLiquid: NetLiquid[] = []
    cashFlow?.forEach((cashFlow: CashFlowHeader) => {
      netLiquid.push({
        year: cashFlow.name,
        value: cashFlow.value.LucroLiquidoExercicioConsolidado,
      })
    })

    const netLiquidArray = Array.from(netLiquid)
    netLiquidArray.forEach((netLiquid, index) => {
      if (netLiquid.value === 0) netLiquidArray.splice(index, 1)
    })

    return netLiquid
  }

  private getDividends() {
    const indicators = this.props.indicators!
    const dividendInfo = this.props.dividendInfo!

    const lastDividendsYield: number[] = []

    // ? ULTIMOS DIVIDENDOS PAGOS

    for (const dividend of indicators.dy.olds) {
      if (lastDividendsYield.length === 10) break
      const dyValue = Number(dividend.value)
      lastDividendsYield.push(dyValue)
    }

    // ? DIVIDENDOS POR ANO

    const lastDividendsPerYear: number[] = []
    for (const dividend of dividendInfo.lastDividendPaymentsYear.reverse()) {
      if (lastDividendsPerYear.length === 10) break
      lastDividendsPerYear.push(dividend.value)
    }

    return { lastDividendsPerYear, lastDividendsYield }
  }

  validate(props: instanceStockProps) {
    if (!props.priceHistory) throw new Error('Error getting price history')
    if (!props.payout) throw new Error('Error getting payout')
    if (!props.dividendInfo) throw new Error('Error getting dividend info')
    if (!props.passiveChart) throw new Error('Error getting passive chart')
  }
}
