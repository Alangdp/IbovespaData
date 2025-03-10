/* eslint-disable camelcase */
import { RequestHandler } from 'express'

import { StockProps, StockSheet } from '../types/stock.types.js'
import { StockDataBase } from '../useCases/stockDataBase.js'
import { errorResponse, response } from '../utils/Responses.js'

const stockRepository = new StockDataBase()

// Rota que retorna todos os dados relacionados ao StockProps
const index: RequestHandler = async (req, res) => {
  try {
    const ticker: string = req.params.ticker
    const stock: StockProps = await stockRepository.getStock(ticker)

    return response(res, {
      status: 200,
      data: stock,
    })
  } catch (error) {
    return errorResponse(res, error)
  }
}

const indexSheets: RequestHandler = async (req, res) => {
  try {
    const ticker: string = req.params.ticker
    const stock: StockProps = await stockRepository.getStock(ticker)

    const { name, segment, dividendYield, payout } = stock
    const {
      roe,
      p_l,
      roic,
      dividaliquida_ebitda,
      receitas_cagr5,
      dividaliquida_ebit,
    } = stock.indicators

    const stockSheet: StockSheet = {
      header: [ticker, name, segment],
      dataHeader: [
        'ROE',
        'ROIC',
        'P/L',
        'DY',
        'DIVIDALIQUIDA/EBITDA',
        'CAGR5',
        'DIVIDA LIQUIDA/EBIT',
        'PAYOUT',
      ],
      data: [
        roe.actual,
        roic.actual,
        p_l.actual,
        dividendYield,
        dividaliquida_ebitda.actual,
        receitas_cagr5.actual,
        dividaliquida_ebit.actual,
        payout,
      ],
    }

    return response(res, {
      status: 200,
      data: stockSheet,
    })
  } catch (error) {
    return errorResponse(res, error)
  }
}

// Rota que retorna apenas as informações relacionadas ao preço
const indexPrice: RequestHandler = async (req, res) => {
  try {
    const ticker: string = req.params.ticker
    const stock: StockProps = await stockRepository.getStock(ticker)

    return response(res, {
      status: 200,
      data: {
        ticker: stock.ticker,
        price: stock.priceHistory,
        actualPrice: stock.actualPrice,
      },
    })
  } catch (error) {
    return errorResponse(res, error)
  }
}

// Rota que retorna as informações sobre dividendos
const indexDividends: RequestHandler = async (req, res) => {
  try {
    const ticker: string = req.params.ticker
    const stock: StockProps = await stockRepository.getStock(ticker)

    return response(res, {
      status: 200,
      data: {
        dividendYield: stock.dividendYield,
        lastDividendsValueYear: stock.lastDividendsValueYear,
        lastDividendsValue: stock.lastDividendsValue,
      },
    })
  } catch (error) {
    return errorResponse(res, error)
  }
}

// Rota que retorna os indicadores financeiros da ação
const indexIndicators: RequestHandler = async (req, res) => {
  try {
    const ticker: string = req.params.ticker
    const stock: StockProps = await stockRepository.getStock(ticker)

    return response(res, {
      status: 200,
      data: stock.indicators,
    })
  } catch (error) {
    return errorResponse(res, error)
  }
}

// Rota que retorna as variáveis de Graham
const indexGraham: RequestHandler = async (req, res) => {
  try {
    const ticker: string = req.params.ticker
    const stock: StockProps = await stockRepository.getStock(ticker)

    return response(res, {
      status: 200,
      data: {
        netLiquid: stock.netLiquid,
        passiveChart: stock.passiveChart,
      },
    })
  } catch (error) {
    return errorResponse(res, error)
  }
}

// // Rota que retorna o fluxo de caixa
// const indexCashFlow: RequestHandler = async (req, res) => {
//   try {
//     const ticker: string = req.params.ticker
//     const stock: StockProps = await stockRepository.getStock(ticker)

//     return response(res, {
//       status: 200,
//       data: stock.,
//     })
//   } catch (error) {
//     return errorResponse(res, error)
//   }
// }

// Rota que retorna o histórico de preços
const indexHistory: RequestHandler = async (req, res) => {
  try {
    const ticker: string = req.params.ticker
    const stock: StockProps = await stockRepository.getStock(ticker)

    return response(res, {
      status: 200,
      data: stock.priceHistory,
    })
  } catch (error) {
    return errorResponse(res, error)
  }
}

// Rota que retorna o histórico de dividendos
const indexDividendsHistory: RequestHandler = async (req, res) => {
  try {
    const ticker: string = req.params.ticker
    const stock: StockProps = await stockRepository.getStock(ticker)

    return response(res, {
      status: 200,
      data: stock.lastDividendsValue,
    })
  } catch (error) {
    return errorResponse(res, error)
  }
}

export {
  index,
  indexSheets,
  indexPrice,
  indexDividends,
  indexIndicators,
  indexGraham,
  //   indexCashFlow,
  indexHistory,
  indexDividendsHistory,
}
