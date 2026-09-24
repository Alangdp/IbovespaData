import type { RequestHandler } from 'express'

import type { Pontuation } from '@/Entities/Pontuation.js'
import { Redis } from '@/global/Redis.js'
import { PontuationDataBase } from '@/useCases/PontuationDatabase.js'

import { errorResponse, response } from '../utils/Responses.js'

const pontuationDatabase = new PontuationDataBase()

/** Retorna a pontuação Bazin de uma ação (GET /bazin/:ticker) */
export const index: RequestHandler<{ ticker: string }> = async (req, res) => {
  try {
    // Busca a pontuação
    const pontuation = await pontuationDatabase.getPoints({
      type: 'BAZIN',
      ticker: req.params.ticker,
    })
    return response(res, { status: 200, data: pontuation })
  } catch (error) {
    return errorResponse(res, error)
  }
}

/** Retorna todas as pontuações Bazin do cache (GET /bazin) */
export const indexAll: RequestHandler = async (_req, res) => {
  try {
    const bazinList =
      await Redis.getAllObjectWithFromCache<Pontuation>('points-BAZIN-')
    return response(res, { status: 200, data: bazinList })
  } catch (error) {
    return errorResponse(res, error)
  }
}
