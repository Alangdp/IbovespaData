import { Redis } from '@/global/Redis.js'
import { IStockDatabase } from '@/types/Database/StockRepository.type.js'
import { StockProps } from '@/types/stock.types.js'

// import env from '../env.js'
import { InstanceStock } from './instanceStock.js'

// const HOUR_IN_MILISECONDS = 3600000

// const TOLERANCE_UPDATE = env.TOLERANCE_TIME_HOURS * HOUR_IN_MILISECONDS

interface StockCache extends StockProps {
  lastUpdate: number
}

export class StockDataBase implements IStockDatabase {
  async getStock(
    ticker: string,
    timeExpireSeconds?: number,
  ): Promise<StockProps> {
    const cachedStock = await Redis.getObjectFromCache<StockCache>(
      `STOCK-${ticker}`,
    )

    if (cachedStock) {
      return cachedStock as StockProps
    }

    const newStock = await this.getNewStock(ticker)
    const stockCache: StockCache = {
      ...newStock,
      lastUpdate: Date.now(),
    }
    Redis.saveObjectToCache(
      `STOCK-${ticker}`,
      stockCache,
      timeExpireSeconds || undefined,
    )

    return newStock
  }

  async getNewStock(ticker: string): Promise<StockProps> {
    const newStock = await InstanceStock.execute(ticker)
    return newStock
  }
}
