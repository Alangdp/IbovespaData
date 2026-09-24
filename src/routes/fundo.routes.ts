import express from 'express'

import {
  index,
  indexTaxas,
  listFundos,
} from '../controllers/fundo.controller.js'

const router = express.Router()

// Rota que retorna a lista de fundos imobiliários (todos ou filtrados por ?tickers=)
router.get('/fundos', listFundos)

// Rota que retorna o detalhe de um fundo imobiliário
router.get('/fundos/:ticker', index)

// Rota que retorna o cálculo da taxa de administração, trimestre a trimestre
router.get('/fundos/:ticker/taxas', indexTaxas)

export default router
