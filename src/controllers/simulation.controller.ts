import type { RequestHandler } from 'express'

import { Simulation } from '../Entities/Simulation'
import { errorResponse, response } from '../utils/Responses'

/** Valor inicial investido na simulação (R$) */
const START_INVEST_VALUE = 1000

/**
 * Retorna a simulação de investimento na ação nos últimos 5 anos
 * (GET /simulation/:ticker)
 */
// TODO - Cache para tickers inválidos (Geral do sistema)
export const index: RequestHandler<{ ticker: string }> = async (req, res) => {
  try {
    // Carrega o histórico de preços e executa a simulação
    const simulation = new Simulation(req.params.ticker, START_INVEST_VALUE)
    await simulation.initialize()
    const data = simulation.execute()

    return response(res, { status: 200, data })
  } catch (error) {
    console.log(error)
    return errorResponse(res, error)
  }
}
