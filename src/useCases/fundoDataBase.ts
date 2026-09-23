import type { Fundo } from '../Entities/Fundo.js'
import { Redis } from '../global/Redis.js'
import { FundoFetcher } from './FundoFetcher.js'

const CACHE_PREFIX = 'FUNDO-'
// Indicadores de FII fecham 1x/dia após o pregão; 6h é uma folga confortável
// sem deixar o dado velho demais durante o dia.
const DEFAULT_TTL_SECONDS = 6 * 60 * 60

interface FundoCache extends Fundo {
  lastUpdate: number
}

export class FundoDataBase {
  async getFundo(ticker: string): Promise<Fundo> {
    const symbol = ticker.trim().toUpperCase()
    const cached = await Redis.getObjectFromCache<FundoCache>(
      `${CACHE_PREFIX}${symbol}`,
    )

    if (cached) return cached

    const fundo = await FundoFetcher.execute(symbol)
    const fundoCache: FundoCache = { ...fundo, lastUpdate: Date.now() }
    await Redis.saveObjectToCache(
      `${CACHE_PREFIX}${symbol}`,
      fundoCache,
      DEFAULT_TTL_SECONDS,
    )

    return fundo
  }

  // tickers omitido => todos os fundos disponíveis (listagem enxuta, ver
  // FundoFetcher.executeAll). tickers informado => um fundo por vez via
  // getFundo (cada um cacheado e enriquecido individualmente); tickers
  // inválidos ou sem dado na fonte são apenas omitidos do array de retorno.
  async getFundos(tickers?: string[]): Promise<Fundo[]> {
    if (!tickers || tickers.length === 0) {
      return FundoFetcher.executeAll()
    }

    const uniqueTickers = Array.from(
      new Set(
        tickers
          .map((ticker) => ticker.trim().toUpperCase())
          .filter((ticker) => ticker.length > 0),
      ),
    )

    const settled = await Promise.all(
      uniqueTickers.map((ticker) => this.getFundo(ticker).catch(() => null)),
    )

    return settled.filter((fundo): fundo is Fundo => fundo !== null)
  }
}
