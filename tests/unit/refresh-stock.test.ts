import { describe, expect, test } from 'bun:test'
import { UnrecoverableError } from 'bullmq'

import {
  CACHE_SECONDS,
  createStockRefresher,
} from '../../src/queues/refreshStock'

function setup(getStock: (ticker: string) => Promise<unknown>) {
  const saved: { key: string; data: unknown; ttl: number }[] = []
  const refresh = createStockRefresher({
    getStock,
    saveToCache: async (key, data, ttl) => {
      saved.push({ key, data, ttl })
    },
  })
  return { refresh, saved }
}

describe('createStockRefresher', () => {
  test('busca o ticker e renova o cache STOCK-<ticker> com TTL curto', async () => {
    const stock = { ticker: 'PETR4', actualPrice: 49.64 }
    const { refresh, saved } = setup(async () => stock)

    await refresh({ data: { ticker: 'PETR4' } })

    expect(saved).toEqual([
      { key: 'STOCK-PETR4', data: stock, ttl: CACHE_SECONDS },
    ])
    expect(CACHE_SECONDS).toBe(120)
  })

  test('falha transitória é relançada (o BullMQ repete com backoff)', async () => {
    const { refresh, saved } = setup(async () => {
      throw new Error('BLOCKED REQUEST CODE 403')
    })

    const error = await refresh({ data: { ticker: 'VALE3' } }).catch((e) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(UnrecoverableError)
    expect(saved).toHaveLength(0)
  })

  test('ticker inexistente (404) vira UnrecoverableError: não repete', async () => {
    const { refresh } = setup(async () => {
      throw new Error('INVALID TICKER CODE 404')
    })

    const error = await refresh({ data: { ticker: 'ZZZZ99' } }).catch((e) => e)

    expect(error).toBeInstanceOf(UnrecoverableError)
    expect(error.message).toBe('INVALID TICKER CODE 404')
  })
})
