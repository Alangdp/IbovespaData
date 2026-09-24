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
import { join } from 'node:path'

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
  LTV_QUEUE: 'fnet ltv',
  LTV_JOB: 'load',
  ltvQueue: { add: async () => {}, on: () => {} },
}))

let server: Server
let base: string

async function get(path: string) {
  const response = await fetch(`${base}${path}`)
  return { status: response.status, body: (await response.json()) as any }
}

beforeAll(async () => {
  replayFixtures()
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
  // Registro da CVM do MXRF11, como o job de carga grava no Redis
  cache.set(
    'CVM-FII-97521225000125',
    JSON.stringify({
      cnpj: '97521225000125',
      isin: 'BRMXRFCTF008',
      gestora: {
        nome: 'XP VISTA ASSET MANAGEMENT LTDA.',
        cnpj: '16789525000198',
      },
      patrimonio: [
        { data: '2026-04-01', valor: 4000000000 },
        { data: '2026-05-01', valor: 4000000000 },
        { data: '2026-06-01', valor: 4000000000 },
      ],
      trimestres: [
        {
          data: '2026-06-30',
          taxaAdministracao: 9000000,
          resultadoSemestre: 100,
          resultadoSemestre95: 95,
          rendimentosDeclarados: 99,
        },
      ],
      endividamento: { data: '2026-06-01', obrigacoes: 0, ativo: 4100000000 },
    }),
  )
  cache.set('CVM-ISIN-MXRF', JSON.stringify('97521225000125'))
  // LTV já lido do relatório gerencial (evita baixar o PDF no teste)
  cache.set(
    'FNET-LTV-97521225000125',
    JSON.stringify({ ltv: 56, referencia: '31/07/2026' }),
  )

  test('GET /fundos/:ticker', async () => {
    const { status, body } = await get('/fundos/mxrf11')

    expect(status).toBe(200)
    expect(body.data.ticker).toBe('MXRF11')
    expect(body.data.segmento).toBe('Papel')
    expect(body.data.dividend_yield_12m).toBeNumber()
    expect(body.data.dividendos_mensais).toHaveLength(12)
  })

  test('GET /fundos/:ticker segue o schema Fundo do openapi.yaml', async () => {
    const spec = Bun.YAML.parse(
      await Bun.file(join(import.meta.dir, '..', '..', 'openapi.yaml')).text(),
    ) as any
    const schema = spec.components.schemas.Fundo

    for (const ticker of ['MXRF11', 'HGLG11', 'BCFF11']) {
      const { body } = await get(`/fundos/${ticker}`)

      expect(Object.keys(body.data).sort()).toEqual(
        Object.keys(schema.properties).sort(),
      )
      for (const field of schema.required) {
        expect(body.data[field]).toBeDefined()
      }
      expect(schema.properties.segmento).toBeDefined()
      expect(spec.components.schemas.Segmento.enum).toContain(
        body.data.segmento,
      )
    }
  })

  test('GET /fundos/:ticker usa os informes da CVM', async () => {
    const { body } = await get('/fundos/MXRF11')

    expect(body.data.gestora).toBe('XP VISTA ASSET MANAGEMENT LTDA.')
    expect(body.data.gestora_cnpj).toBe('16789525000198')
    expect(body.data.taxa_administracao).toBe(0.9)
    expect(body.data.limite_distribuicao_respeitado).toBe(true)
    expect(body.data.percentual_distribuido).toBe(99)
    expect(body.data.alavancagem).toBe(0)
    expect(body.data.ltv_medio).toBe(56)
    expect(body.data.ltv_referencia).toBe('31/07/2026')
    expect(body.data.dividendo_extraordinario_ultimo_ano).toBeBoolean()
  })

  test('GET /fundos/:ticker/taxas detalha o cálculo', async () => {
    const { status, body } = await get('/fundos/mxrf11/taxas')

    expect(status).toBe(200)
    expect(body.data).toEqual({
      ticker: 'MXRF11',
      cnpj: '97521225000125',
      taxa_administracao: 0.9,
      trimestres: [
        {
          trimestre: '2026-06-30',
          taxa_paga: 9000000,
          patrimonio_medio: 4000000000,
          percentual_anualizado: 0.9,
        },
      ],
    })
  })

  test('GET /fundos/:ticker/taxas de fundo inexistente vira 404', async () => {
    const { status } = await get('/fundos/ZZZZ11/taxas')
    expect(status).toBe(404)
  })

  test('GET /fundos/:ticker de tijolo traz imóveis e vacância', async () => {
    const { body } = await get('/fundos/HGLG11')

    expect(body.data.segmento).toBe('Tijolo')
    expect(body.data.num_imoveis).toBeGreaterThan(0)
    expect(body.data.vacancia_fisica).toBeNumber()
    expect(body.data.area_total).toBeGreaterThan(0)
  })

  test('GET /fundos/:ticker inexistente vira 404', async () => {
    const { status, body } = await get('/fundos/ZZZZ11')

    expect(status).toBe(404)
    expect(body.errors[0].message).toContain('ZZZZ11')
  })

  test('GET /fundos?tickers= omite os inválidos', async () => {
    const { status, body } = await get('/fundos?tickers=MXRF11,ZZZZ11,HGLG11')

    expect(status).toBe(200)
    expect(body.data.map((f: any) => f.ticker)).toEqual(['MXRF11', 'HGLG11'])
  })

  test('GET /fundos (todos) usa a listagem resumida', async () => {
    const { status, body } = await get('/fundos')

    expect(status).toBe(200)
    expect(body.data.length).toBeGreaterThan(500)
    expect(body.data.every((f: any) => f.dividendos_mensais.length === 0)).toBe(
      true,
    )
  })
})
