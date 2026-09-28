import { Redis } from '@/global/Redis.js'
import type { StockProps } from '@/types/stock.types.js'

import { instanceStock } from './instanceStock.js'

/** Ação como fica guardada no cache, com o momento da gravação */
interface StockCache extends StockProps {
  lastUpdate: number
}

/** Acesso às ações, com cache no Redis (chave `STOCK-<ticker>`) */
export class StockDataBase {
  /**
   * Retorna a ação do cache ou, se não estiver lá, busca nas fontes e grava
   *
   * @param ticker - Código da ação (ex.: PETR4)
   * @param timeExpireSeconds - Validade do cache (padrão do `Redis`)
   */
  async getStock(
    ticker: string,
    timeExpireSeconds?: number,
  ): Promise<StockProps> {
    // Busca a ação no cache
    const cachedStock = await Redis.getObjectFromCache<StockCache>(
      `STOCK-${ticker}`,
    )
    // Se a ação está no cache
    if (cachedStock) {
      return cachedStock
    }

    // Busca a ação nas fontes e grava no cache sem esperar a gravação
    const stock = await instanceStock(ticker)
    const stockCache: StockCache = { ...stock, lastUpdate: Date.now() }
    Redis.saveObjectToCache(`STOCK-${ticker}`, stockCache, timeExpireSeconds)

    return stock
  }
}
