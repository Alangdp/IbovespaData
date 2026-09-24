import { CustomError } from '@/errors/CustomError.js'
import { MacroInfo } from '@/global/MacroInfo.js'
import { Redis } from '@/global/Redis.js'
import { Bazin } from '../Entities/Bazin'
import { Graham } from '../Entities/Graham'
import type { Pontuation } from '../Entities/Pontuation.js'
import env from '../env.js'
import { StockDataBase } from './stockDataBase.js'

/** Método de pontuação */
type PontuationType = 'BAZIN' | 'GRAHAM'

interface DatabaseProps {
  ticker?: string
  type: PontuationType
}

/** Pontuação como fica guardada no cache, com o momento do cálculo */
interface PontuationCache extends Pontuation {
  lastUpdate: number
}

/** Idade máxima de uma pontuação no cache antes de ser recalculada (ms) */
const TOLERANCE_UPDATE = env.TOLERANCE_TIME_HOURS * 60 * 60 * 1000

const stockRepository = new StockDataBase()

/** Acesso às pontuações, com cache no Redis (chave `points-<tipo>-<ticker>`) */
export class PontuationDataBase {
  /**
   * Retorna a pontuação do cache ou, se estiver ausente ou velha, recalcula e
   * grava
   *
   * @throws CustomError 400 se o ticker não for informado
   */
  async getPoints({ ticker, type }: DatabaseProps): Promise<Pontuation> {
    // Se o ticker não foi informado
    if (!ticker) {
      throw new CustomError('Ticker is required', 400)
    }

    // Busca a pontuação no cache
    const cacheKey = `points-${type}-${ticker}`
    const cachedData = await Redis.getObjectFromCache<PontuationCache>(cacheKey)
    // Se a pontuação está no cache e dentro da tolerância
    if (cachedData && cachedData.lastUpdate >= Date.now() - TOLERANCE_UPDATE) {
      return cachedData
    }

    // Calcula a pontuação a partir dos dados da ação
    const stock = await stockRepository.getStock(ticker)
    const pontuation =
      type === 'BAZIN'
        ? new Bazin(stock).makePoints()
        : new Graham(stock, await MacroInfo.getCDI()).makePoints()

    // Grava a pontuação no cache
    await Redis.saveObjectToCache(cacheKey, {
      ...pontuation,
      lastUpdate: Date.now(),
    })

    return pontuation
  }
}
