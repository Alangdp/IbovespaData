import { Queue } from 'bullmq'

import env from '@/env'

export interface stockQueueData {
  ticker: string
}

export const STOCK_QUEUE = 'stock get'
export const STOCK_JOB = 'refresh'

// O BullMQ abre as próprias conexões a partir destas opções
export const queueConnection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
}

export const stockQueue = new Queue<stockQueueData>(STOCK_QUEUE, {
  connection: queueConnection,
  defaultJobOptions: {
    // Falhas transitórias (rede, bloqueio 403 do statusinvest) são repetidas
    // com espera crescente: 30s, 1min, 2min, 4min
    attempts: 5,
    backoff: { type: 'exponential', delay: 30_000 },
    // Sem isso os jobs concluídos/falhos se acumulam para sempre no Redis
    removeOnComplete: { age: 60 * 60 },
    removeOnFail: { age: 24 * 60 * 60 },
  },
})

// Sem um listener de 'error' o EventEmitter derruba o processo quando o Redis
// fica indisponível
stockQueue.on('error', (error) => {
  console.error('[stockQueue] erro:', error.message)
})
