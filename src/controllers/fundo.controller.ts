import type { RequestHandler } from 'express'

import { FundoDataBase } from '../useCases/fundoDataBase.js'
import { errorResponse, response } from '../utils/Responses.js'

const fundoRepository = new FundoDataBase()

/** Retorna o detalhe de um fundo imobiliário (GET /fundos/:ticker) */
export const index: RequestHandler<{ ticker: string }> = async (req, res) => {
  try {
    // Busca o fundo
    const fundo = await fundoRepository.getFundo(req.params.ticker)
    return response(res, { status: 200, data: fundo })
  } catch (error) {
    return errorResponse(res, error)
  }
}

/**
 * Retorna o cálculo da taxa de administração, trimestre a trimestre
 * (GET /fundos/:ticker/taxas)
 */
export const indexTaxas: RequestHandler<{ ticker: string }> = async (
  req,
  res,
) => {
  try {
    const taxas = await fundoRepository.getTaxas(req.params.ticker)
    return response(res, { status: 200, data: taxas })
  } catch (error) {
    return errorResponse(res, error)
  }
}

/**
 * Retorna a lista de fundos imobiliários (GET /fundos)
 *
 * Sem `?tickers`, retorna todos os fundos disponíveis. Com
 * `?tickers=GGRC11,BTLG11`, retorna só os informados
 */
export const listFundos: RequestHandler = async (req, res) => {
  try {
    // Carrega os tickers informados na query, se houver
    const { tickers } = req.query
    const tickerList =
      typeof tickers === 'string' && tickers
        ? tickers.split(',').map((ticker) => ticker.trim())
        : undefined

    // Busca os fundos
    const fundos = await fundoRepository.getFundos(tickerList)
    return response(res, { status: 200, data: fundos })
  } catch (error) {
    return errorResponse(res, error)
  }
}
