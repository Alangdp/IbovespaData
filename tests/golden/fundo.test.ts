import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setSystemTime,
  test,
} from 'bun:test'

import { FundoFetcher } from '../../src/useCases/FundoFetcher'
import { expectGolden } from '../support/golden'
import { replayFixtures } from '../support/http-fixtures'

// Caracterização da montagem dos FIIs a partir das respostas do statusinvest
// gravadas em tests/fixtures (papel, tijolo e fundo de fundos)

const TICKERS = ['MXRF11', 'HGLG11', 'BCFF11']

beforeAll(() => {
  replayFixtures()
  // Data da gravação das fixtures (o dividendo extraordinário olha 12 meses)
  setSystemTime(new Date('2026-09-23T15:00:00Z'))
})

afterAll(() => {
  setSystemTime()
})

describe.each(TICKERS)('%s', (ticker) => {
  test('detalhe do fundo', async () => {
    const list = await FundoFetcher.fetchList()
    const item = list.find((fii) => fii.ticker === ticker)
    if (!item) {
      throw new Error(`${ticker} ausente da listagem gravada`)
    }

    expectGolden(`fundo-${ticker}`, await FundoFetcher.buildDetail(item))
  })
})

describe('listagem', () => {
  test('resumo só com os segmentos do contrato', async () => {
    const list = await FundoFetcher.fetchList()
    const fundos = list
      .map((item) => FundoFetcher.buildSummary(item))
      .filter((fundo) => fundo !== null)

    expect(fundos.length).toBeGreaterThan(500)
    expect(fundos.length).toBeLessThan(list.length)
    expect(new Set(fundos.map((fundo) => fundo.segmento))).toEqual(
      new Set(['Tijolo', 'Papel', 'Híbrido', 'FoF']),
    )
    expectGolden('fundos-resumo', {
      total: fundos.length,
      mxrf11: fundos.find((fundo) => fundo.ticker === 'MXRF11'),
    })
  })
})
