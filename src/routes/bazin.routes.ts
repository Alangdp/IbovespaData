import express from 'express';
import { indexBazin } from '../controllers/stock.controller.js';

const router = express.Router();

router.get('/bazin/:ticker', indexBazin);

export default router;
