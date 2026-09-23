import express from 'express'

import { index, listFundos } from '../controllers/fundo.controller.js'

const router = express.Router()

// Rota que retorna a lista de fundos imobiliários (todos ou filtrados por ?tickers=)
router.get('/fundos', listFundos)

// Rota que retorna o detalhe de um fundo imobiliário
router.get('/fundos/:ticker', index)

export default router
