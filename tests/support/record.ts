// Grava as respostas reais das fontes externas usadas pelos testes.
//   bun tests/support/record.ts
// Depois regrave os golden files:  UPDATE_GOLDEN=1 bun test
import { Simulation } from '../../src/Entities/Simulation'
import { fetchAllTickers } from '../../src/sources/fundamentus'
import { fetchStockPage } from '../../src/sources/statusinvest'
import { FundoFetcher } from '../../src/useCases/FundoFetcher'
import { instanceStock } from '../../src/useCases/instanceStock'
import { recordFixtures } from './http-fixtures'

const TICKERS = ['PETR4', 'ITUB4']
const INVALID_TICKER = 'ZZZZ99'
export const FII_TICKERS = ['MXRF11', 'HGLG11', 'BCFF11']

const recorder = recordFixtures()

for (const ticker of TICKERS) {
  await instanceStock(ticker)
  const simulation = new Simulation(ticker, 1000)
  await simulation.initialize()
  console.log(`gravado: ${ticker}`)
}

try {
  await fetchStockPage(INVALID_TICKER)
} catch (error) {
  console.log(`gravado: ${INVALID_TICKER} (${(error as Error).message})`)
}

const fiis = await FundoFetcher.fetchList()
for (const ticker of FII_TICKERS) {
  const item = fiis.find((fii) => fii.ticker === ticker)
  if (item) {
    await FundoFetcher.buildDetail(item)
    console.log(`gravado: ${ticker}`)
  }
}

const tickers = await fetchAllTickers()
console.log(`gravado: listagem do fundamentus (${tickers.length} tickers)`)

recorder.save()
console.log(`${recorder.size()} respostas salvas`)
process.exit(0)
