import { Stock } from '../Entities/Stock'
import { BasicInfoReturn } from '../types/BasicInfo.type'
import { DividendReturn } from '../types/dividends.type'
import { Header } from '../types/get.type'
import { FinancialIndicators } from '../types/indicators.type'
import { PassiveChartReturn } from '../types/PassiveChart.type'
import { PayoutReturn } from '../types/Payout.type'
import { PriceReturn } from '../types/prices.type'
import { CashFlowHeader, NetLiquid, StockProps } from '../types/stock.types'
import TickerFetcher from './Fetcher.js'

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
  public static stock: Stock | null = null
  private tickerFetcher: TickerFetcher
  private props: instanceStockProps = {
    priceHistory: null,
    payout: null,
    dividendInfo: null,
    basicInfo: null,
    indicators: null,
    cashFlow: null,
    passiveChart: null,
  }

  private constructor(tickerFetcher: TickerFetcher) {
    this.tickerFetcher = tickerFetcher
  }

  static async execute(ticker: string) {
    const tickerFetcher = await new TickerFetcher(ticker).initialize()
    const instanceStock = new InstanceStock(tickerFetcher)
    await instanceStock.initialize()
    const stock = InstanceStock.stock
    if (!stock) throw new Error('Error creating stock')
    return stock
  }

  private async initialize() {
    await this.getData()
    this.validate(this.props)
    InstanceStock.stock = await this.build()
  }

  private async build() {
    const stockProps = this.makeStockProps()
    return new Stock(stockProps)
  }

  private async getData() {
    this.props.basicInfo = await this.tickerFetcher.getBasicInfo()
    this.props.priceHistory = await this.tickerFetcher.getPrice()
    this.props.dividendInfo = await this.tickerFetcher.getDividendInfo()
    this.props.payout = await this.tickerFetcher.getPayout()
    this.props.indicators = await this.tickerFetcher.getIndicatorsInfo()
    this.props.cashFlow = await this.tickerFetcher.getCashFlow()
    this.props.passiveChart = await this.tickerFetcher.getPassiveChart()
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
    for (const dividend of dividendInfo?.lastDividendPaymentsYear.reverse()) {
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
