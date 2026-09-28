import { Worker } from 'bullmq'

import { LTV_QUEUE, type ltvQueueData, queueConnection } from '@/global/Queue'
import { Redis } from '@/global/Redis'
import { fundoCacheKey } from '@/useCases/fundoDataBase'
import { LtvDataBase } from '@/useCases/ltvDataBase'

import { createLtvRefresher } from './refreshLtv'

const ltvDataBase = new LtvDataBase()

/**
 * Worker que lê o LTV do relatório gerencial de um fundo e invalida o cache
 * do detalhe, para a próxima requisição já trazer o LTV
 *
 * Concorrência 1: o FNET fica lento com downloads em paralelo
 */
export const ltvWorker = new Worker<ltvQueueData>(
  LTV_QUEUE,
  createLtvRefresher({
    loadLtv: (cnpj) => ltvDataBase.load(cnpj),
    invalidateFundo: (ticker) => Redis.deleteFromCache(fundoCacheKey(ticker)),
  }),
  { connection: queueConnection, concurrency: 1 },
)

// Registra os logs de falha e de erro (sem o listener de erro o EventEmitter
// derruba o processo quando o Redis fica indisponível)
ltvWorker.on('failed', (job, error) => {
  console.error(
    `[ltvQueue] falha ao ler o LTV de ${job?.data.ticker} ` +
      `(tentativa ${job?.attemptsMade}): ${error.message}`,
  )
})
ltvWorker.on('error', (error) => {
  console.error('[ltvQueue] erro no worker:', error.message)
})
