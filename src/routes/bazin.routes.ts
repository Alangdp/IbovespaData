import express from 'express'

import { index, indexAll } from '@/controllers/bazin.controller'

const router = express.Router()

router.get('/bazin/:ticker', index)
router.get('/bazin', indexAll)

export default router
