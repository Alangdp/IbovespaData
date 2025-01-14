import express from 'express'

import { index } from '../controllers/stock.controller.js'

const router = express.Router()

router.get('/stock/:ticker', index)

export default router
