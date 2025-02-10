import Queue from 'bull'

import { stockQueue, stockQueueData } from '@/global/Queue'
import { Redis } from '@/global/Redis'
import { StockDataBase } from '@/useCases/stockDataBase'

const stockDataBase = new StockDataBase()
stockQueue.process(5, async (job: Queue.Job<stockQueueData>, done) => {
  await new Promise((resolve) => setTimeout(resolve, 1000))

  try {
    console.log('Processing', job.data.ticker)
    const stockData = await stockDataBase.getStock(job.data.ticker)
    Redis.saveObjectToCache(
      `STOCK-${job.data.ticker}`,
      stockData,
      3600 * 24 * 1000,
    )
    done()
  } catch (error) {
    console.log('Error', error)
    stockQueue.add(job.data)
    done(error as Error)
  }
})
