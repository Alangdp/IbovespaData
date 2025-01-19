import Queue from 'bull'

import { stockQueue, stockQueueData } from '@/global/Queue'
import { Redis } from '@/global/Redis'
import { StockDataBase } from '@/useCases/stockDataBase'

const stockDataBase = new StockDataBase()
stockQueue.process(2, async (job: Queue.Job<stockQueueData>, done) => {
  try {
    const stockData = await stockDataBase.getStock(job.data.ticker)
    Redis.saveObjectToCache(`STOCK-${job.data.ticker}`, stockData, 120)
    done()
  } catch (error) {
    stockQueue.add(job.data)
    done(error as Error)
  }
})
