import express from 'express';
import { indexGraham } from '../controllers/stock.controller.js';

const router = express.Router();

router.get('/graham/:ticker', indexGraham);

export default router;
