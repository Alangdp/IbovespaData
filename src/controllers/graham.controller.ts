import type { RequestHandler } from 'express'

import type { Pontuation } from '@/Entities/Pontuation.js'
import { Redis } from '@/global/Redis.js'
import { PontuationDataBase } from '@/useCases/PontuationDatabase.js'

import { errorResponse, response } from '../utils/Responses.js'

const pontuationDatabase = new PontuationDataBase()

/** Retorna a pontuação Graham de uma ação (GET /graham/:ticker) */
export const index: RequestHandler<{ ticker: string }> = async (req, res) => {
  try {
    // Busca a pontuação
    const pontuation = await pontuationDatabase.getPoints({
      type: 'GRAHAM',
      ticker: req.params.ticker,
    })
    return response(res, { status: 200, data: pontuation })
  } catch (error) {
    return errorResponse(res, error)
  }
}

/** Retorna todas as pontuações Graham do cache (GET /graham) */
export const indexAll: RequestHandler = async (_req, res) => {
  try {
    const grahamList =
      await Redis.getAllObjectWithFromCache<Pontuation>('points-GRAHAM-')
    return response(res, { status: 200, data: grahamList })
  } catch (error) {
    return errorResponse(res, error)
  }
}
