import { AxiosError } from 'axios'
import type { Response } from 'express'
import { ZodError } from 'zod'

import { CustomError } from '../errors/CustomError'
import type { ErrorResponse, ResponseProps } from '../types/responses.type'

/** Envia a resposta no formato padrão `{ status, data, errors }` */
export function response<T>(
  res: Response,
  { data, status, errors = [] }: ResponseProps<T>,
) {
  return res.status(status).json({ status, data, errors })
}

/**
 * Converte um erro na resposta HTTP adequada
 *
 * - mensagem com `404`: 400 Invalid Ticker
 * - `CustomError`: o código do próprio erro
 * - `ZodError`: 400 com uma entrada por campo inválido
 * - `AxiosError`: o status e os erros da API chamada, ou 400
 * - `TypeError`: 500 sem expor a mensagem
 * - demais: 500 com a mensagem
 */
export function errorResponse(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  // Se é um ticker inexistente
  if (message.includes('404')) {
    return response(res, {
      status: 400,
      errors: [addError('Invalid Ticker', null)],
    })
  }

  // Se é um erro da própria aplicação
  if (error instanceof CustomError) {
    return response(res, {
      data: {},
      status: error.customCode || 500,
      errors: [addError(message, {})],
    })
  }

  // Se é erro de validação
  if (error instanceof ZodError) {
    return response(res, {
      data: {},
      status: 400,
      errors: error.issues.map((issue) =>
        addError(issue.message, issue.path.join('.')),
      ),
    })
  }

  // Se é erro de uma API externa
  if (error instanceof AxiosError) {
    // Se a API respondeu, repassa o status e os erros dela
    if (error.response) {
      const body: ResponseProps<unknown> = error.response.data
      return response(res, {
        data: {},
        status: body.status,
        errors: body.errors?.map((err) => addError(err.message, {})),
      })
    }

    return response(res, {
      data: {},
      status: 400,
      errors: [addError(message, {})],
    })
  }

  // Se é erro de programação, esconde a mensagem
  if (error instanceof TypeError) {
    return response(res, {
      data: {},
      status: 500,
      errors: [addError('Internal Error', {})],
    })
  }

  return response(res, {
    data: {},
    status: 500,
    errors: [addError(message, {})],
  })
}

/** Monta uma entrada do campo `errors` */
export function addError(message: string, data: unknown): ErrorResponse {
  return { message, data }
}
