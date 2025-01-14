import TickerFetcher from '../useCases/Fetcher.js'
import { PontuationDataBase } from '../useCases/PontuationDatabase.js'
import { StockDataBase } from '../useCases/stockDataBase.js'
import JSON from '../utils/Json.js'

interface DatabaseSeedProps {
  tickers: string[]
}

class DatabaseSeed {
  private tickers: string[]
  private invalidTicker: string[] = []
  private rankingBazin: unknown[] = []
  private rankingGraham: unknown[] = []

  constructor(props: DatabaseSeedProps) {
    this.tickers = props.tickers
    return this
  }

  async execute() {
    for (const ticker of this.tickers) {
      try {
        await this.getData(ticker)
      } catch (error) {
        if (error instanceof Error) {
          this.invalidTicker.push(error.message)
        }

        console.error(error)
      }
    }

    JSON.saveJSONToFile(this.invalidTicker, 'invalidTickers.json')
  }

  async getData(ticker: string) {
    const { getStock } = await StockDataBase.startDatabase()

    try {
      const stock = await getStock(ticker)
      this.rankingBazin.push(
        await PontuationDataBase.get({ ticker: stock.ticker, type: 'BAZIN' }),
      )
      this.rankingGraham.push(
        await PontuationDataBase.get({ ticker: stock.ticker, type: 'GRAHAM' }),
      )
      return true
    } catch (error) {
      throw new Error(ticker)
    }
  }
}

async function teste() {
  const tickers = await TickerFetcher.getAllTickers()
  const seed = new DatabaseSeed({ tickers })
  seed.execute()
}

teste()
