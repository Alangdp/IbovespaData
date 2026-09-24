import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setSystemTime,
  test,
} from 'bun:test'

import { Bazin } from '../../src/Entities/Bazin'
import { Graham } from '../../src/Entities/Graham'
import { Simulation } from '../../src/Entities/Simulation'
import { fetchAllTickers } from '../../src/sources/fundamentus'
import { fetchStockPage } from '../../src/sources/statusinvest'
import { instanceStock } from '../../src/useCases/instanceStock'
import { expectGolden } from '../support/golden'
import { replayFixtures } from '../support/http-fixtures'

// Caracterização do fluxo de scraping -> Stock -> pontuações, com as respostas
// HTTP gravadas em tests/fixtures. Serve de rede de segurança para refatorar
// fontes/instanceStock sem mudar o resultado. Para regravar as fixtures:
//   bun tests/support/record.ts && UPDATE_GOLDEN=1 bun test

const TICKERS = ['PETR4', 'ITUB4']

// CDI anual fixo (BCB, série 4389, 22/09/2026) para o Graham não depender da rede
const CDI = 0.1365

function digest(value: unknown) {
  return new Bun.CryptoHasher('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
}

beforeAll(() => {
  replayFixtures()
  setSystemTime(new Date('2026-09-23T15:00:00Z'))
})

afterAll(() => {
  setSystemTime()
})

describe.each(TICKERS)('%s', (ticker) => {
  test('instanceStock monta o Stock completo', async () => {
    const stock = await instanceStock(ticker)

    // priceHistory é longo (5 anos diários): guarda o resumo + hash
    const { priceHistory, ...rest } = JSON.parse(JSON.stringify(stock))
    expectGolden(`stock-${ticker}`, {
      ...rest,
      priceHistory: {
        length: priceHistory.length,
        first: priceHistory[0],
        last: priceHistory[priceHistory.length - 1],
        sha256: digest(priceHistory),
      },
    })
  })

  test('pontuação Bazin', async () => {
    const stock = await instanceStock(ticker)
    expectGolden(`bazin-${ticker}`, new Bazin(stock).makePoints())
  })

  test('pontuação Graham', async () => {
    const stock = await instanceStock(ticker)
    expectGolden(`graham-${ticker}`, new Graham(stock, CDI).makePoints())
  })

  test('simulação de investimento', async () => {
    const simulation = new Simulation(ticker, 1000)
    await simulation.initialize()
    const result = simulation.execute()

    expectGolden(`simulation-${ticker}`, {
      startSimulation: result.startSimulation,
      endSimulation: result.endSimulation,
      gainOrLoss: result.gainOrLoss,
      history: {
        length: result.history.length,
        first: result.history[0],
        last: result.history[result.history.length - 1],
        sha256: digest(result.history),
      },
    })
  })
})

describe('fontes externas', () => {
  test('ticker inválido (404) vira erro legível', async () => {
    await expect(fetchStockPage('ZZZZ99')).rejects.toThrow(
      'INVALID TICKER CODE 404',
    )
  })

  test('fetchAllTickers lê a listagem do fundamentus', async () => {
    const tickers = await fetchAllTickers()
    expectGolden('all-tickers', {
      length: tickers.length,
      first: tickers.slice(0, 10),
      sha256: digest(tickers),
    })
  })
})
