import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import axios, { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'

import { fetchFiiPage } from '../../src/sources/statusinvest/fii'
import { fetchStockPage } from '../../src/sources/statusinvest/page'
import { errorResponse } from '../../src/utils/Responses'

// Erro do axios como o statusinvest devolve: corpo em HTML, sem `status`
function httpError(status: number) {
  const response = {
    status,
    data: '<html>bloqueado</html>',
    headers: {},
    statusText: '',
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse
  return new AxiosError('falhou', String(status), undefined, null, response)
}

function mockGet(result: () => Promise<unknown>) {
  return spyOn(axios, 'get').mockImplementation(result as typeof axios.get)
}

// `res` mínimo do Express, que lança como o Express 5 para status inválido
function fakeRes() {
  const res = {
    statusCode: 0,
    body: undefined as any,
    status(code: number) {
      if (!Number.isInteger(code)) {
        throw new TypeError(`Invalid status code: ${code}`)
      }
      res.statusCode = code
      return res
    },
    json(body: unknown) {
      res.body = body
      return res
    },
  }
  return res
}

afterEach(() => {
  ;(axios.get as any).mockRestore?.()
})

describe.each([
  ['fetchFiiPage', fetchFiiPage],
  ['fetchStockPage', fetchStockPage],
])('%s', (_, fetchPage) => {
  test('403 vira Error simples com o código na mensagem', async () => {
    mockGet(() => Promise.reject(httpError(403)))

    const error = await fetchPage('TEST11').catch((e) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(AxiosError)
    expect(error.message).toBe('BLOCKED REQUEST CODE 403')
  })

  test('404 vira INVALID TICKER', async () => {
    mockGet(() => Promise.reject(httpError(404)))

    await expect(fetchPage('TEST11')).rejects.toThrow('INVALID TICKER CODE 404')
  })

  test('outros status viram Error simples', async () => {
    mockGet(() => Promise.reject(httpError(500)))

    const error = await fetchPage('TEST11').catch((e) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(AxiosError)
  })

  test('o erro chega ao errorResponse como JSON, sem status inválido', async () => {
    mockGet(() => Promise.reject(httpError(429)))
    const error = await fetchPage('TEST11').catch((e) => e)
    const res = fakeRes()

    expect(() => errorResponse(res as any, error)).not.toThrow()
    expect(res.body.status).toBe(res.statusCode)
  })
})

describe('fetchFiiPage', () => {
  test('baixa a página do fundo com o ticker em minúsculas', async () => {
    const get = mockGet(() => Promise.resolve({ data: '<html></html>' }))

    await expect(fetchFiiPage('MXRF11')).resolves.toBe('<html></html>')
    expect(get.mock.calls[0][0]).toBe(
      'https://statusinvest.com.br/fundos-imobiliarios/mxrf11',
    )
  })
})
