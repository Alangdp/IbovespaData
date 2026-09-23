import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type Job, Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'

import { createStockRefresher } from '../../src/queues/refreshStock'

// Integração com um Redis REAL (BullMQ + ioredis rodando no Bun). Sobe com
// `docker compose up -d`; sem Redis disponível os testes são pulados, para
// não travar o CI nem quem roda `bun test` sem Docker.

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
}

async function redisAvailable() {
  const client = new Redis({
    ...connection,
    lazyConnect: true,
    connectTimeout: 500,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  })
  client.on('error', () => {})
  try {
    await client.connect()
    await client.ping()
    return true
  } catch {
    return false
  } finally {
    client.disconnect()
  }
}

const available = await redisAvailable()

describe.skipIf(!available)('fila de atualização (BullMQ + Redis real)', () => {
  // Fila própria do teste: não mexe na fila de produção ("stock get")
  const name = `test-stock-${Date.now()}`
  const attemptsByTicker = new Map<string, number>()

  let queue: Queue
  let worker: Worker

  // Espera o job terminar consultando o estado dele. (QueueEvents também
  // serviria, mas as notificações por stream chegam de forma intermitente
  // no Bun e deixariam o teste instável; o worker em si não usa isso.)
  async function settle(job: Job, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const current = await queue.getJob(job.id!)
      const state = await current?.getState()

      if (state === 'completed' || state === 'failed') {
        return { state, failedReason: current?.failedReason }
      }
      await Bun.sleep(20)
    }
    throw new Error(`Job ${job.id} não terminou em ${timeoutMs}ms`)
  }

  beforeAll(async () => {
    queue = new Queue(name, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'fixed', delay: 50 },
      },
    })

    const refresh = createStockRefresher({
      getStock: async (ticker) => {
        const attempt = (attemptsByTicker.get(ticker) ?? 0) + 1
        attemptsByTicker.set(ticker, attempt)

        if (ticker === 'FLAKY3' && attempt < 3) throw new Error('rede caiu')
        if (ticker === 'ZZZZ99') throw new Error('INVALID TICKER CODE 404')
        return { ticker }
      },
      saveToCache: async () => {},
    })
    worker = new Worker(name, refresh, { connection, concurrency: 2 })
    worker.on('error', () => {})

    await worker.waitUntilReady()
  })

  afterAll(async () => {
    await worker.close()
    await queue.obliterate({ force: true })
    await queue.close()
  })

  test('processa um job', async () => {
    const job = await queue.add('refresh', { ticker: 'PETR4' })

    expect(await settle(job)).toEqual({
      state: 'completed',
      failedReason: undefined,
    })
    expect(attemptsByTicker.get('PETR4')).toBe(1)
  })

  test('falha transitória é repetida até dar certo', async () => {
    const job = await queue.add('refresh', { ticker: 'FLAKY3' })

    expect((await settle(job)).state).toBe('completed')
    expect(attemptsByTicker.get('FLAKY3')).toBe(3)
  })

  test('ticker inexistente falha na hora, sem novas tentativas', async () => {
    const job = await queue.add('refresh', { ticker: 'ZZZZ99' })

    expect(await settle(job)).toEqual({
      state: 'failed',
      failedReason: 'INVALID TICKER CODE 404',
    })
    expect(attemptsByTicker.get('ZZZZ99')).toBe(1)
  })
})
