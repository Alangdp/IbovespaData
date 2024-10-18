import express from 'express';
import dotenv from 'dotenv';
import {
  index,
  indexBazin,
  indexFullStock,
  indexGraham,
} from '../controllers/stock.controller.js';
dotenv.config();

const router = express.Router();

router.get('/stock/:ticker', index);

router.get('/bazin/:ticker', indexBazin);
router.get('/graham/:ticker', indexGraham);

router.post('/full', indexFullStock);

export default router;
