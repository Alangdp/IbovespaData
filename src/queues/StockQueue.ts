import { Worker } from 'bullmq'

import {
  queueConnection,
  STOCK_QUEUE,
  type stockQueueData,
} from '@/global/Queue'
import { Redis } from '@/global/Redis'
import { StockDataBase } from '@/useCases/stockDataBase'

import { createStockRefresher } from './refreshStock'

const stockDataBase = new StockDataBase()

/** Worker da fila de atualização de ações (iniciado pelo server.ts) */
export const stockWorker = new Worker<stockQueueData>(
  STOCK_QUEUE,
  createStockRefresher({
    getStock: (ticker) => stockDataBase.getStock(ticker),
    saveToCache: (key, data, ttlSeconds) =>
      Redis.saveObjectToCache(key, data, ttlSeconds),
  }),
  { connection: queueConnection, concurrency: 2 },
)

// Registra o log de cada tentativa que falhar
stockWorker.on('failed', (job, error) => {
  console.error(
    `[stockQueue] falha ao atualizar ${job?.data.ticker} ` +
      `(tentativa ${job?.attemptsMade}): ${error.message}`,
  )
})

// Registra o listener de erro: sem ele o EventEmitter derruba o processo
// quando o Redis fica indisponível
stockWorker.on('error', (error) => {
  console.error('[stockQueue] erro no worker:', error.message)
})
