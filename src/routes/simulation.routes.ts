import express from 'express';
import { index } from '../controllers/simulation.controller';

const router = express.Router();

router.get('/simulation/:ticker', index);

export default router;
