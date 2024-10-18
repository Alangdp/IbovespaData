import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import cors, { CorsOptions } from 'cors';

import './database/index.js';

import stockRoutes from './routes/stock.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

class App {
  app;
  constructor() {
    this.app = express();
    this.middlewares();
    this.routes();
  }
  routes() {
    this.app.use('/', stockRoutes);
  }

  middlewares() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use('*', cors());
    this.app.options('*', cors());

    this.app.use(
      '/images/logos',
      express.static(path.join(__dirname, '..', 'assets', 'imgs', 'logos'))
    );

    this.app.use(
      '/images/avatar',
      express.static(path.join(__dirname, '..', 'assets', 'imgs', 'avatar'))
    );
  }
}
export default new App().app;