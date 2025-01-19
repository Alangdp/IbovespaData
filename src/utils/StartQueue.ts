import { stockQueue } from '@/global/Queue'
import TickerFetcher from '@/useCases/Fetcher'

import Json from './Json'

async function startQueue() {
  const invalidTickers = Json.readJSONFromFile('invalidTickers.json')
  const allTickers = await TickerFetcher.getAllTickers()

  const validTicker = allTickers.filter(
    (ticker) => !invalidTickers.includes(ticker),
  )

  for (const ticker of validTicker) {
    stockQueue.add({ ticker })
  }

  console.log('Terminou')
}

startQueue()
