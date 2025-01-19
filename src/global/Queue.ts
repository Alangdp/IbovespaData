import Queue from 'bull'

import env from '@/env'
import { StockDataBase } from '@/useCases/stockDataBase'

import { Redis } from './Redis'

export const stockQueue = new Queue('stock get', {
  redis: { port: env.REDIS_PORT, host: env.REDIS_HOST },
})

interface stockQueueData {
  ticker: string
}

const stockDataBase = new StockDataBase()
stockQueue.process(2, async (job: Queue.Job<stockQueueData>, done) => {
  const stockData = await stockDataBase.getStock(job.data.ticker)
  Redis.saveObjectToCache(`STOCK-${job.data.ticker}`, stockData, 120)
  done()
})
