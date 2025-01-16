import express from 'express'

import { index, indexAll } from '@/controllers/graham.controller'

const router = express.Router()

router.get('/graham/:ticker', index)
router.get('/graham', indexAll)

export default router
