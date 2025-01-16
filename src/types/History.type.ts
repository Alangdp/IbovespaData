import { ChartProtocol } from '../interfaces/ChartProtocol.type.js'
import { ChartConstructor } from './Chart.type.js'
import { DividendOnDate } from './dividends.type.js'
import { IndexDividend, IndexHistoryPrice } from './Index.type.js'
import { StockInfo, StockPrice } from './stock.types.js'
import { TransactionsProps } from './transaction.type.js'

export interface HistoryData {
  [date: string]: {
    date: string
    prices: StockPrice
    dividends: DividendOnDate
    transactions: TransactionsProps[]
    chart?: ChartConstructor
  }
}

export interface HistoryProps {
  stockInfo: StockInfo
  transactions: TransactionsProps[]
  historyData: HistoryData
  chart: ChartProtocol
  indexHistoryPrice: IndexHistoryPrice
  indexDividend: IndexDividend
}

export interface SimplifiedHistoryData {
  [date: string]: {
    date: string
    prices: StockPrice
    dividends: DividendOnDate
    transactions: TransactionsProps[]
    chart?: ChartProtocol
  }
}

export interface SimplifiedDataHistory {
  transactions: TransactionsProps[]
  historyData: SimplifiedHistoryData
  chart: ChartProtocol
}

export interface HistoryRequirements {
  stockInfo: StockInfo
  transactions: TransactionsProps[]
}
