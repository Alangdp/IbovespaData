import type { RequestHandler } from 'express'

import type { StockProps } from '../types/stock.types.js'
import { StockDataBase } from '../useCases/stockDataBase.js'
import { errorResponse, response } from '../utils/Responses.js'

const stockRepository = new StockDataBase()

/**
 * Cria uma rota `/:ticker` que busca a ação e devolve o recorte escolhido
 *
 * @param select - Extrai da ação o que vai no campo `data` da resposta
 */
function stockRoute(
  select: (stock: StockProps) => unknown,
): RequestHandler<{ ticker: string }> {
  return async (req, res) => {
    try {
      // Busca a ação
      const stock = await stockRepository.getStock(req.params.ticker)
      return response(res, { status: 200, data: select(stock) })
    } catch (error) {
      return errorResponse(res, error)
    }
  }
}

/** Retorna todos os dados da ação */
export const index = stockRoute((stock) => stock)

/** Retorna apenas as informações relacionadas ao preço */
export const indexPrice = stockRoute((stock) => ({
  ticker: stock.ticker,
  price: stock.priceHistory,
  actualPrice: stock.actualPrice,
}))

/** Retorna as informações sobre dividendos */
export const indexDividends = stockRoute((stock) => ({
  dividendYield: stock.dividendYield,
  lastDividendsValueYear: stock.lastDividendsValueYear,
  lastDividendsValue: stock.lastDividendsValue,
}))

/** Retorna os indicadores financeiros da ação */
export const indexIndicators = stockRoute((stock) => stock.indicators)

/** Retorna as variáveis usadas por Graham */
export const indexGraham = stockRoute((stock) => ({
  netLiquid: stock.netLiquid,
  passiveChart: stock.passiveChart,
}))

/** Retorna o histórico de preços */
export const indexHistory = stockRoute((stock) => stock.priceHistory)

/** Retorna o histórico de dividendos */
export const indexDividendsHistory = stockRoute(
  (stock) => stock.lastDividendsValue,
)
