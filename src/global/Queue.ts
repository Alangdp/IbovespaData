import Queue from 'bull'

import env from '@/env'

export interface stockQueueData {
  ticker: string
}

export const stockQueue = new Queue<stockQueueData>('stock get', {
  redis: { port: env.REDIS_PORT, host: env.REDIS_HOST },
})
