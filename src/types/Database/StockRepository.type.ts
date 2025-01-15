import { StockProps } from '../stock.types'

export interface IStockDatabase {
  getStock(ticker: string): Promise<StockProps>
  getNewStock(ticker: string): Promise<StockProps>
}
