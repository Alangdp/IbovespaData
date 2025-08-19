import { Stock } from '../Entities/Stock'
import { CustomError } from '@/errors/CustomError.js'
import { Redis } from '@/global/Redis.js'

import { Bazin } from '../Entities/Bazin'
import { Granham } from '../Entities/Graham'
import { Pontuation } from '../Entities/Pontuation.js'
import env from '../env.js'
import { StockDataBase } from './stockDataBase.js'

interface DatabaseProps {
  ticker?: string
  type: 'BAZIN' | 'GRAHAM'
}

// Horas em milisegundosq
const HOUR_IN_MILISECONDS = 3600000
// Tolerância de atualização
const TOLERANCE_UPDATE = env.TOLERANCE_TIME_HOURS * HOUR_IN_MILISECONDS

// Instancia a interface de banco de dados (Redis)
const stockRepository = new StockDataBase()

// Interface de banco de dados com tempo de criação
interface PontuationCache extends Pontuation {
  lastUpdate: number
}

export class PontuationDataBase {
  private static toleranceTime: number = env.TOLERANCE_TIME_HOURS_RANKING

  async getPoints(props: DatabaseProps): Promise<Pontuation> {
    if (!props.ticker) throw new CustomError('Ticker is required', 400)

    const cachedData = await Redis.getObjectFromCache<PontuationCache>(
      `points-${props.type}-${props.ticker}`,
    )

    if (
      !cachedData ||
      cachedData.lastUpdate < new Date().getTime() - TOLERANCE_UPDATE
    ) {
      // Instancia a interface de pontuação
      let pontuation: Pontuation | undefined
      // Instancia as informações do ticker
      const stock = await stockRepository.getStock(props.ticker)

      // Verifica o tipo de pontuação
      if (props.type === 'BAZIN') {
        // Instancia a interface de Bazin
        pontuation = new Bazin(stock).makePoints(stock)
      }

      // Verifica o tipo de pontuação
      if (props.type === 'GRAHAM') {
        // Instancia a interface de Ações(Requerida para a interface de Graham)
        const stockProtocol = new Stock(stock)
        // Instancia a interface de Graham
        pontuation = await new Granham(stockProtocol).makePoints(stockProtocol)
      }

      // Salva a pontuação no cache
      await Redis.saveObjectToCache(`points-${props.type}-${props.ticker}`, {
        ...pontuation,
        lastUpdate: new Date().getTime(),
      })

      // Retorna a pontuação
      if (!pontuation) throw new CustomError('Invalid Type', 400)
      return pontuation
    }

    return cachedData
  }
}
