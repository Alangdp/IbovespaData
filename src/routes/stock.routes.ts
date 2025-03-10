import express from 'express'

import {
  index,
  indexDividends,
  indexDividendsHistory,
  indexGraham,
  indexHistory,
  indexIndicators,
  indexPrice,
  indexSheets,
} from '../controllers/stock.controller.js'

const router = express.Router()

// Rota que retorna todos os dados relacionados ao StockProps
router.get('/stock/:ticker', index)

// Rota que retorna todos os dados relacionados ao StockProps no formato de...
// ...sheet para o google sheets
router.get('/stock/sheets/:ticker', indexSheets)

// Rota que retorna apenas as informações relacionadas ao preço
router.get('/stock/:ticker/price', indexPrice)

// Rota que retorna as informações sobre dividendos
router.get('/stock/:ticker/dividends', indexDividends)

// Rota que retorna os indicadores financeiros da ação
router.get('/stock/:ticker/indicators', indexIndicators)

// Rota que retorna as variáveis de Graham
router.get('/stock/:ticker/graham', indexGraham)

// Rota que retorna o histórico de preços
router.get('/stock/:ticker/history', indexHistory)

// Rota que retorna o histórico de dividendos
router.get('/stock/:ticker/dividends/history', indexDividendsHistory)

export default router
