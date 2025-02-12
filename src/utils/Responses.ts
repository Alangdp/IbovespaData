import { AxiosError } from 'axios'
import { Response } from 'express'
import { ValidationErrorItem } from 'sequelize'

import { CustomError } from '../errors/CustomError'
import { ErrorResponse, ResponseProps } from '../types/responses.type'

export function response<T>(
  res: Response,
  { data, status, errors }: ResponseProps<T>,
) {
  return res
    .status(status)
    .json({ status, data, errors: !errors ? [] : errors })
}

export function errorResponse(res: Response, error: any) {
  if (error.message && error.message.includes('404'))
    return response(res, {
      status: 400,
      errors: [addError('Invalid Ticker', null)],
    })

  if (error instanceof CustomError) {
    return response(res, {
      data: {},
      status: error.customCode || 500,
      errors: [addError(error.message, {})],
    })
  }

  if (error.errors) {
    const returnErrors: ErrorResponse[] = []
    const sequelizeErrors: ValidationErrorItem[] = error.errors
    sequelizeErrors.map((error) => {
      returnErrors.push(addError(error.message, error.value))
    })

    return response(res, { data: {}, status: 400, errors: returnErrors })
  }

  if (error instanceof AxiosError) {
    if (error.response) {
      const responseError: ResponseProps<any> = error.response.data
      return response(res, {
        data: {},
        status: responseError.status,
        errors: responseError.errors?.map((err) => addError(err.message, {})),
      })
    }

    if (error.status) {
      {
        return response(res, {
          data: {},
          status: error.status ? 400 : 200,
          errors: [addError(error.message, {})],
        })
      }
    }

    return response(res, {
      data: {},
      status: 400,
      errors: [addError(error.message, {})],
    })
  }

  if (error instanceof TypeError)
    return response(res, {
      data: {},
      status: 500,
      errors: [addError('Internal Error', {})],
    })

  return response(res, {
    data: {},
    status: 500,
    errors: [addError(error.message, {})],
  })
}

export function addError(message: string, data: any): ErrorResponse {
  return { message, data }
}
