import {
  afterAll,
  beforeAll,
  describe,
  expect,
  mock,
  setSystemTime,
  test,
} from 'bun:test'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import axios from 'axios'

import { replayFixtures } from '../support/http-fixtures'

// Testa o contrato HTTP de todas as rotas, de ponta a ponta, sem Redis, sem
// fila e sem rede: Redis/Bull são trocados por doubles em memória e as fontes
// externas (statusinvest, fundamentus, brapi) respondem com fixtures.

const cache = new Map<string, string>()

mock.module('../../src/global/Redis', () => ({
  Redis: {
    getInstance: () => ({}),
    addEvent: () => {},
    getObjectFromCache: async (key: string) => {
      const value = cache.get(key)
      return value ? JSON.parse(value) : null
    },
    getAllObjectWithFromCache: async (prefix: string) =>
      [...cache.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([, value]) => JSON.parse(value)),
    saveObjectToCache: async (key: string, data: unknown) => {
      cache.set(key, JSON.stringify(data))
    },
  },
}))
mock.module('../../src/global/Queue', () => ({
  STOCK_QUEUE: 'stock get',
  STOCK_JOB: 'refresh',
  queueConnection: {},
  stockQueue: { add: async () => {}, on: () => {} },
}))

const BRAPI_INDICATOR = {
  symbol: 'MXRF11',
  name: 'Maxi Renda',
  segmentType: 'papel',
  segmentoAtuacao: 'Recebíveis',
  administratorName: 'BTG Pactual',
  price: 9.5,
  navPerShare: 9.6,
  dividendYield12m: 0.12,
}

function brapiResponse(url: string) {
  if (url.endsWith('/indicators') || url.endsWith('/list'))
    return { fiis: [BRAPI_INDICATOR] }
  if (url.endsWith('/dividends'))
    return {
      dividends: [
        {
          symbol: 'MXRF11',
          paymentDate: '2026-08-14',
          exDate: '2026-07-31',
          rate: 0.1,
        },
      ],
    }
  if (url.endsWith('/reports')) return { reports: [] }
  return { fiis: [] }
}

let server: Server
let base: string

async function get(path: string) {
  const response = await fetch(`${base}${path}`)
  return { status: response.status, body: (await response.json()) as any }
}

beforeAll(async () => {
  replayFixtures()
  const replay = axios.defaults.adapter as (config: any) => Promise<any>
  axios.defaults.adapter = async (config) => {
    if (String(config.url).startsWith('https://brapi.dev')) {
      return {
        data: JSON.stringify(brapiResponse(String(config.url))),
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {},
      }
    }
    return replay(config)
  }
  setSystemTime(new Date('2026-09-23T15:00:00Z'))

  const { default: app } = await import('../../src/app')
  server = app.listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.close()
  setSystemTime()
})

describe('rotas de ações', () => {
  test('GET /stock/:ticker', async () => {
    const { status, body } = await get('/stock/PETR4')

    expect(status).toBe(200)
    expect(body.status).toBe(200)
    expect(body.errors).toEqual([])
    expect(body.data.ticker).toBe('PETR4')
    expect(body.data.actualPrice).toBeNumber()
    expect(body.data.priceHistory.length).toBeGreaterThan(1000)
  })

  test('GET /stock/:ticker/price', async () => {
    const { body } = await get('/stock/PETR4/price')
    expect(Object.keys(body.data).sort()).toEqual([
      'actualPrice',
      'price',
      'ticker',
    ])
  })

  test('GET /stock/:ticker/dividends', async () => {
    const { body } = await get('/stock/PETR4/dividends')
    expect(Object.keys(body.data).sort()).toEqual([
      'dividendYield',
      'lastDividendsValue',
      'lastDividendsValueYear',
    ])
  })

  test('GET /stock/:ticker/indicators', async () => {
    const { body } = await get('/stock/PETR4/indicators')
    expect(body.data.dy).toBeDefined()
    expect(body.data.p_l).toBeDefined()
  })

  test('GET /stock/:ticker/graham', async () => {
    const { body } = await get('/stock/PETR4/graham')
    expect(Object.keys(body.data).sort()).toEqual(['netLiquid', 'passiveChart'])
  })

  test('GET /stock/:ticker/history e /dividends/history', async () => {
    const history = await get('/stock/PETR4/history')
    const dividends = await get('/stock/PETR4/dividends/history')

    expect(history.body.data.length).toBeGreaterThan(1000)
    expect(dividends.body.data.length).toBeGreaterThan(0)
  })

  test('ticker inexistente vira 400 Invalid Ticker', async () => {
    const { status, body } = await get('/stock/ZZZZ99')

    expect(status).toBe(400)
    expect(body.errors[0].message).toBe('Invalid Ticker')
  })
})

describe('rotas de pontuação', () => {
  test('GET /bazin/:ticker', async () => {
    const { status, body } = await get('/bazin/PETR4')

    expect(status).toBe(200)
    expect(body.data.subId).toBe('BAZIN')
    expect(body.data.totalPoints).toBeNumber()
    expect(body.data.totalEvaluate).toHaveLength(9)
  })

  test('GET /graham/:ticker e a listagem /graham', async () => {
    const one = await get('/graham/PETR4')
    expect(one.status).toBe(200)
    expect(one.body.data.subId).toBe('GRAHAM')
    expect(one.body.data.totalEvaluate).toHaveLength(12)

    const all = await get('/graham')
    expect(all.body.data.map((p: any) => p.id)).toContain('PETR4')
  })
})

describe('CORS', () => {
  test('respostas trazem Access-Control-Allow-Origin', async () => {
    const response = await fetch(`${base}/stock/PETR4/price`, {
      headers: { Origin: 'http://localhost:5173' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })

  test('preflight OPTIONS é respondido sem chegar na rota', async () => {
    const response = await fetch(`${base}/stock/PETR4`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-methods')).toContain(
      'GET',
    )
  })
})

describe('arquivos estáticos', () => {
  test('GET /images/avatar/:arquivo serve as imagens de assets/', async () => {
    const response = await fetch(`${base}/images/avatar/PETR4-logo.jpg`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/jpeg')
  })

  test('imagem inexistente devolve 404', async () => {
    const response = await fetch(`${base}/images/avatar/NAOEXISTE-logo.jpg`)
    expect(response.status).toBe(404)
  })
})

describe('rota de simulação', () => {
  test('GET /simulation/:ticker', async () => {
    const { status, body } = await get('/simulation/PETR4')

    expect(status).toBe(200)
    expect(body.data.history.length).toBeGreaterThan(1000)
    expect(Object.keys(body.data.history[0]).sort()).toEqual([
      'date',
      'gainOrLossCDI',
      'gainOrLossGeneral',
      'gainOrLossIndividual',
      'price',
      'totalCapital',
    ])
  })
})

describe('rotas de fundos', () => {
  test('GET /fundos/:ticker', async () => {
    const { status, body } = await get('/fundos/mxrf11')

    expect(status).toBe(200)
    expect(body.data.ticker).toBe('MXRF11')
    expect(body.data.segmento).toBe('Papel')
    expect(body.data.dividend_yield_12m).toBe(12)
  })

  test('GET /fundos?tickers=', async () => {
    const { status, body } = await get('/fundos?tickers=MXRF11')

    expect(status).toBe(200)
    expect(body.data.map((f: any) => f.ticker)).toEqual(['MXRF11'])
  })

  test('GET /fundos (todos) usa a listagem enxuta', async () => {
    const { status, body } = await get('/fundos')

    expect(status).toBe(200)
    expect(body.data[0].ticker).toBe('MXRF11')
  })
})
