import type { RequestHandler } from 'express'

import { Simulation } from '../Entities/Simulation'
import { errorResponse, response } from '../utils/Responses'

// TODO - Cache para tickers inválidos (Geral do sistema)

const index: RequestHandler<{ ticker: string }> = async (req, res) => {
  try {
    const { ticker } = req.params
    const simulation = new Simulation(ticker, 1000)
    await simulation.initialize()

    const data = await simulation.execute()

    return response(res, {
      status: 200,
      data,
    })
  } catch (error: any) {
    console.log(error)
    return errorResponse(res, error)
  }
}

export { index }
