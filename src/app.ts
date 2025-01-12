import './database/index.js'

import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import path from 'path'

import bazinRoutes from './routes/bazin.routes.js'
import grahamRoutes from './routes/graham.routes.js'
import simulationRoutes from './routes/simulation.routes.js'
import stockRoutes from './routes/stock.routes.js'

dotenv.config()

class App {
  app
  constructor() {
    this.app = express()
    this.middlewares()
    this.routes()
  }

  routes() {
    this.app.get('/', (req, res) => {
      res.status(301).redirect('http://localhost:3000')
    })

    this.app.use('/', stockRoutes)
    this.app.use('/', bazinRoutes)
    this.app.use('/', grahamRoutes)
    this.app.use('/', simulationRoutes)
  }

  middlewares() {
    this.app.use(express.json())
    this.app.use(express.urlencoded({ extended: true }))
    this.app.use('*', cors())
    this.app.options('*', cors())

    this.app.use(
      '/images/logos',
      express.static(path.join(__dirname, '..', 'assets', 'imgs', 'logos')),
    )

    this.app.use(
      '/images/avatar',
      express.static(path.join(__dirname, '..', 'assets', 'imgs', 'avatar')),
    )
  }
}
export default new App().app
