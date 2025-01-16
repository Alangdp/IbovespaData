import { RequestHandler } from 'express'

import { Pontuation } from '@/entities/Pontuation.js'
import { Redis } from '@/global/Redis.js'
import { PontuationDataBase } from '@/useCases/PontuationDatabase.js'

import { errorResponse, response } from '../utils/Responses.js'

const pontuationDatabase = new PontuationDataBase()

// Rota que retorna todos os dados relacionados ao calculo do Graham para X ticker
const index: RequestHandler = async (req, res) => {
  try {
    const ticker: string = req.params.ticker
    const stock = await pontuationDatabase.getPoints({
      type: 'GRAHAM',
      ticker,
    })

    return response(res, {
      status: 200,
      data: stock,
    })
  } catch (error) {
    return errorResponse(res, error)
  }
}

// Rota que retorna todos os dados relacionados ao calculo do Graham
const indexAll: RequestHandler = async (req, res) => {
  try {
    const grahamList =
      await Redis.getAllObjectWithFromCache<Pontuation>('points-GRAHAM-')

    return response(res, {
      status: 200,
      data: grahamList,
    })
  } catch (error) {
    return errorResponse(res, error)
  }
}

export { index, indexAll }
