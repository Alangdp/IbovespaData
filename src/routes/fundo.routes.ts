import express from 'express'

import {
  index,
  indexCriterios,
  indexTaxas,
  listFundos,
  listGestoras,
  listRegioes,
} from '../controllers/fundo.controller.js'

const router = express.Router()

// Rota que retorna a lista de fundos imobiliários (todos ou filtrados por ?tickers=)
router.get('/fundos', listFundos)

// Rota que retorna a classificação das cidades por tipo de imóvel (antes de
// /fundos/:ticker, senão "regioes" vira ticker)
router.get('/fundos/regioes', listRegioes)

// Rota que retorna o detalhe de um fundo imobiliário
router.get('/fundos/:ticker', index)

// Rota que retorna o cálculo da taxa de administração, trimestre a trimestre
router.get('/fundos/:ticker/taxas', indexTaxas)

// Rota que retorna o cálculo de diversificado, boa_localizacao e
// gestora_confiavel
router.get('/fundos/:ticker/criterios', indexCriterios)

// Rota que retorna as gestoras de FII, para montar a lista de confiáveis
router.get('/gestoras', listGestoras)

export default router
