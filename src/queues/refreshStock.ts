import { UnrecoverableError } from 'bullmq'

import type { stockQueueData } from '@/global/Queue'

export const CACHE_SECONDS = 120

interface Dependencies {
  getStock: (ticker: string) => Promise<unknown>
  saveToCache: (key: string, data: unknown, ttlSeconds: number) => Promise<void>
}

// Cria o processador dos jobs da fila: busca os dados atuais do ticker e
// renova o cache `STOCK-<ticker>`. Quando essa chave expira, o Redis avisa e
// um novo job é enfileirado (ver global/Redis.ts), mantendo o cache aquecido.
// As dependências entram por parâmetro para o processador poder ser testado
// sem Redis (a montagem real está em StockQueue.ts).
export function createStockRefresher({ getStock, saveToCache }: Dependencies) {
  return async (job: { data: stockQueueData }) => {
    const { ticker } = job.data

    try {
      const stockData = await getStock(ticker)
      await saveToCache(`STOCK-${ticker}`, stockData, CACHE_SECONDS)
    } catch (error) {
      // Ticker inexistente (404): repetir o job não adianta
      if (error instanceof Error && error.message.includes('404')) {
        throw new UnrecoverableError(error.message)
      }
      throw error
    }
  }
}
