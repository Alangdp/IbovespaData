import express from 'express';
import { indexBazin, indexBazinAll } from '../controllers/stock.controller.js';

const router = express.Router();

router.get('/bazin/:ticker', indexBazin);
router.get('/bazin/', indexBazinAll);

export default router;
