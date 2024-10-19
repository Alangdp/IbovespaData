import express from 'express';
import {
  index,
  indexPrice,
  indexIndicators,
  indexBySegment,
} from '../controllers/stock.controller.js';

const router = express.Router();

router.get('/stock/:ticker', index);
router.get('/stock/price/:ticker', indexPrice);
router.get('/stock/indicators/:ticker', indexIndicators);
router.get('/stock/segment/:segment', indexBySegment);

// router.get('/stock/:ticker', index);
// router.get('/stock/:ticker', index);
// router.get('/stock/:ticker', index);

export default router;
