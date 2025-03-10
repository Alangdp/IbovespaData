import { VariableProps } from '../interfaces/Variable.type'
import { Dividend, LastDividendPayment } from './dividends.type'
import { FinancialIndicators } from './indicators.type'
import { PassiveChartReturn } from './PassiveChart.type'

export type NetLiquid = {
  year: string
  value: number
}

export interface PriceHistory {
  date: string
  price: number
}

export interface StockProps extends VariableProps {
  // Abrangent Data

  segment: string

  lpa: number
  p_l: number
  freeFloat: number

  // Variables from Stock

  ticker: string
  name: string
  activeValue: number
  actualPrice: number
  priceHistory: PriceHistory[]
  shareQuantity: number

  // Bazin variables

  dividendYield: number
  grossDebt: number
  patrimony: number
  payout: number
  actualDividendYield: number

  lastDividendsYieldYear: number[]
  lastDividendsValueYear: number[]
  lastDividendsValue: LastDividendPayment[]
  indicators: FinancialIndicators

  // Graham variables

  netLiquid: NetLiquid[]
  passiveChart: PassiveChartReturn[]
}

// Structure to return to Google Sheets
// This structure is used to return stock data in a format that can be
// easily imported into a Google Sheet. Google Sheets converts
// arrays into columns, example:
// ["Taee11", "Taesa", "Eletrica"] = TAEE11 | Taesa | Eletrica
export type StockSheet = {
  // Ticker, Name, Segment
  header: [string, string, string]
  // DY, P/L, ROE
  dataHeader: [string, string, string, string, string, string, string, string]
  data: [number, number, number, number, number, number, number, number]
}

export type CashFlowHeader = {
  name: string
  index: number
  value: { [key: string]: number }
}

export interface StockInfo {
  [ticker: string]: {
    stock: StockProps
    dividend: Dividend[]
    historyPrice: PriceHistory[]
  }
}

export interface StockPrice {
  [ticker: string]: {
    ticker: string
    price: number
  }
}
