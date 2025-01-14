// import { TransactionProtocol } from 'sequelize';

import {
  Chart as ChartModel,
  ChartConstructor,
  ChartPortifolio,
  StockData,
} from '../types/Chart.type'
import { DividendOnDate } from '../types/dividends.type'
import { StockPrice } from '../types/stock.types'
import { TransactionsProps } from '../types/transaction.type'
// import TransactionProtocol from './TransactionProtocol';

// FIXME ARRUMAR SOLID AQUI

export interface ChartProtocol extends ChartConstructor {
  makeEmptyChart(): void
  createTickerOnChart(ticker: string): StockData
  buyUpdate(
    individualChart: StockData,
    ticker: string,
    quantity: number,
    valueInvested: number,
  ): void

  sellUpdate(
    individualChart: StockData,
    ticker: string,
    quantity: number,
    valueInvested: number,
  ): void
  updateGlobals(prices: StockPrice): void

  updateTickers(pricesOnDate: StockPrice, date: string): void
  updateDividends(dividends: DividendOnDate, date: string): void
  updateChart(
    transactions: TransactionsProps[],
    prices: StockPrice,
    dividends: DividendOnDate,
    date: string,
  ): ChartConstructor

  makePortfolioChart(): ChartPortifolio
  returnChart(): ChartModel
}
