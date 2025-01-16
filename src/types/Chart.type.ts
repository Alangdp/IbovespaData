import { DividendOnDate } from './dividends.type'
import { StockPrice } from './stock.types'

export interface ChartPortifolio {
  [ticker: string]: number
}

export interface DividendPayment {
  date: string
  value: number
  unitaryValue: number
}

export interface StockData {
  dividendValue: number
  // Todo Alterar aqui caso de erro
  dividendPayments: DividendPayment[]
  medianPrice: number
  rentability: number
  quantity: number
  valueTotal: number
  valueInvested: number
}

export interface StockRentability {
  [ticker: string]: StockData
}

export interface ChartConstructor {
  globalRentability: number
  globalStockQuantity: number
  globalStockValue: number
  globalDividendValue: number
  globalTotalValue: number
  globalInvested: number
  individualRentability: StockRentability
  portifolio: ChartPortifolio
}

export interface Chart {
  globalRentability: number
  globalStockQuantity: number
  globalStockValue: number
  globalDividendValue: number
  globalTotalValue: number
  individualRentability: StockRentability
}

export interface chartUpdateInfo {
  date: string
  stocksPrice: StockPrice
  dividendsPaymentOnDate: DividendOnDate
  previousDate: string | null
}
