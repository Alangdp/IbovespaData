import type { RequestHandler } from 'express'

import type { Fundo } from '../Entities/Fundo.js'
import { FundoDataBase } from '../useCases/fundoDataBase.js'
import { errorResponse, response } from '../utils/Responses.js'

const fundoRepository = new FundoDataBase()

// Rota que retorna o detalhe de um fundo imobiliário (GET /fundos/:ticker)
const index: RequestHandler<{ ticker: string }> = async (req, res) => {
  try {
    const ticker: string = req.params.ticker
    const fundo: Fundo = await fundoRepository.getFundo(ticker)

    return response(res, {
      status: 200,
      data: fundo,
    })
  } catch (error) {
    return errorResponse(res, error)
  }
}

// Rota que retorna a lista de fundos imobiliários (GET /fundos)
// Sem ?tickers, retorna todos os fundos disponíveis.
// Com ?tickers=GGRC11,BTLG11, retorna só os informados.
const listFundos: RequestHandler = async (req, res) => {
  try {
    const tickersParam = req.query.tickers as string | undefined
    const tickers = tickersParam
      ? tickersParam.split(',').map((ticker) => ticker.trim())
      : undefined

    const fundos: Fundo[] = await fundoRepository.getFundos(tickers)

    return response(res, {
      status: 200,
      data: fundos,
    })
  } catch (error) {
    return errorResponse(res, error)
  }
}

export { index, listFundos }
