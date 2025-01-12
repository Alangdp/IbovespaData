import env from '../env'
import { StockProtocol } from '../interfaces/StockProtocol.type'
import Database from '../utils/JsonDatabase'
import { InstanceStock } from './instanceStock.js'

export class StockDataBase {
  private toleranceTime: number = env.TOLERANCE_TIME_HOURS
  private db = new Database<StockProtocol>('json/stocks.json')

  constructor() {
    return this
  }

  async remakeStock(ticker: string) {
    this.deleteOnDatabase(ticker)
    return await this.createOnDatabase(ticker)
  }

  async getStock(ticker: string) {
    const stock = this.exists(ticker)
    if (!stock) return await this.createOnDatabase(ticker)
    return stock
  }

  private exists(ticker: string): StockProtocol | null {
    const finded = this.db.find((stock) => {
      return stock.ticker === ticker
    })

    if (finded) {
      if (this.validTime(finded)) return finded

      this.deleteOnDatabase(ticker)
      return null
    }

    return null
  }

  private validTime(stock: StockProtocol): boolean {
    if (!stock) return false
    const milliseconds = new Date().getTime() - (stock.instanceTime ?? 0)
    return milliseconds / 3600000 < this.toleranceTime
  }

  async createOnDatabase(ticker: string) {
    const stock = await InstanceStock.execute(ticker)
    this.db.add(stock, true)
    this.db = this.db.commit()

    return stock
  }

  private deleteOnDatabase(ticker: string) {
    this.db.deleteBy((stock) => stock.ticker === ticker)
    this.db = this.db.commit()
  }
}
