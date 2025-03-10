import { Pontuation } from '../entities/Pontuation.js'
import { PontuationDataBase } from '../useCases/PontuationDatabase.js'

// FIXME ARRUMAR SOLID AQUI
// FIXME FUNÇÃO TEMPORARIA

type RankingSystyemProps = {
  tickers: string[]
}

interface Ranking {
  [ticker: string]: Pontuation
}

class RankingSystyem {
  private tickers: string[]
  private ranking: Ranking

  async execute() {
    const pontuation = new PontuationDataBase()

    for (const ticker of this.tickers) {
      try {
        await pontuation.getPoints({ ticker, type: 'BAZIN' })
      } catch (error) {
        continue
      }
    }
  }

  constructor({ tickers }: RankingSystyemProps) {
    this.tickers = tickers
    this.ranking = {}
  }
}
