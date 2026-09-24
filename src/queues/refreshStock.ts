import { UnrecoverableError } from 'bullmq'

import type { stockQueueData } from '@/global/Queue'

/** Validade do cache renovado pela fila (s) */
export const CACHE_SECONDS = 120

/** Dependências do processador, injetadas para permitir testes sem Redis */
interface Dependencies {
  getStock: (ticker: string) => Promise<unknown>
  saveToCache: (key: string, data: unknown, ttlSeconds: number) => Promise<void>
}

/**
 * Cria o processador dos jobs da fila: busca os dados atuais do ticker e
 * renova o cache `STOCK-<ticker>`
 *
 * Quando essa chave expira, o Redis avisa e um novo job é enfileirado (ver
 * global/Redis.ts), mantendo o cache aquecido. A montagem real está em
 * StockQueue.ts
 *
 * @throws UnrecoverableError para ticker inexistente (404), que não adianta
 * repetir
 */
export function createStockRefresher({ getStock, saveToCache }: Dependencies) {
  return async (job: { data: stockQueueData }) => {
    const { ticker } = job.data

    try {
      // Busca a ação e renova o cache
      const stockData = await getStock(ticker)
      await saveToCache(`STOCK-${ticker}`, stockData, CACHE_SECONDS)
    } catch (error) {
      // Se o ticker não existe, encerra sem novas tentativas
      if (error instanceof Error && error.message.includes('404')) {
        throw new UnrecoverableError(error.message)
      }
      throw error
    }
  }
}
