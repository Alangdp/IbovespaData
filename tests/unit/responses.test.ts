import { describe, expect, test } from 'bun:test'
import { AxiosError } from 'axios'
import { z } from 'zod'

import { CustomError } from '../../src/errors/CustomError'
import { errorResponse } from '../../src/utils/Responses'

// `res` mínimo do Express: guarda o status e o corpo enviados.
function fakeRes() {
  const res = {
    statusCode: 0,
    body: undefined as any,
    status(code: number) {
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

function run(error: unknown) {
  const res = fakeRes()
  errorResponse(res as any, error)
  return res
}

describe('errorResponse', () => {
  test('mensagem com "404" vira 400 Invalid Ticker', () => {
    const res = run(new Error('INVALID TICKER CODE 404'))
    expect(res.statusCode).toBe(400)
    expect(res.body.errors).toEqual([{ message: 'Invalid Ticker', data: null }])
  })

  test('CustomError usa o customCode', () => {
    const res = run(new CustomError('Ticker não encontrado: XPTO11', 404))
    expect(res.statusCode).toBe(404)
    expect(res.body.status).toBe(404)
    expect(res.body.errors[0].message).toBe('Ticker não encontrado: XPTO11')
  })

  test('ZodError vira 400 com a mensagem e o caminho de cada issue', () => {
    const result = z
      .object({ ticker: z.string(), nested: z.object({ qty: z.number() }) })
      .safeParse({ ticker: 1, nested: { qty: 'x' } })
    const res = run(result.error)

    expect(res.statusCode).toBe(400)
    expect(res.body.errors).toHaveLength(2)
    expect(res.body.errors.map((e: any) => e.data)).toEqual([
      'ticker',
      'nested.qty',
    ])
  })

  test('AxiosError com response repassa status e erros da resposta', () => {
    const error = new AxiosError('falhou')
    error.response = {
      status: 422,
      data: { status: 422, errors: [{ message: 'dado inválido' }] },
    } as any
    const res = run(error)

    expect(res.statusCode).toBe(422)
    expect(res.body.errors).toEqual([{ message: 'dado inválido', data: {} }])
  })

  test('AxiosError sem response vira 400', () => {
    const res = run(new AxiosError('timeout'))
    expect(res.statusCode).toBe(400)
    expect(res.body.errors[0].message).toBe('timeout')
  })

  test('TypeError vira 500 sem vazar a mensagem', () => {
    const res = run(new TypeError('x is not a function'))
    expect(res.statusCode).toBe(500)
    expect(res.body.errors[0].message).toBe('Internal Error')
  })

  test('erro genérico vira 500 com a mensagem', () => {
    const res = run(new Error('boom'))
    expect(res.statusCode).toBe(500)
    expect(res.body.errors[0].message).toBe('boom')
  })
})
