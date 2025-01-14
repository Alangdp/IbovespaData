import { RequestHandler } from 'express'

import { StockProps } from '../types/stock.types.js'
import { StockDataBase } from '../useCases/stockDataBase.js'
import { errorResponse, response } from '../utils/Responses.js'

const index: RequestHandler = async (req, res) => {
  const { getStock } = await StockDataBase.startDatabase()

  try {
    const ticker: string = req.params.ticker
    const stock: StockProps = await getStock(ticker)

    return response(res, {
      status: 200,
      data: stock,
    })
  } catch (error) {
    return errorResponse(res, error)
  }
}

export { index }
