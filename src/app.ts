import cors from 'cors'
import express from 'express'
import path from 'path'

import bazinRoutes from './routes/bazin.routes.js'
import fundoRoutes from './routes/fundo.routes.js'
import grahamRoutes from './routes/graham.routes.js'
import simulationRoutes from './routes/simulation.routes.js'
import stockRoutes from './routes/stock.routes.js'

class App {
  app
  constructor() {
    this.app = express()
    this.middlewares()
    this.routes()
  }

  routes() {
    this.app.use('/', stockRoutes)
    this.app.use('/', bazinRoutes)
    this.app.use('/', grahamRoutes)
    this.app.use('/', simulationRoutes)
    this.app.use('/', fundoRoutes)
  }

  middlewares() {
    this.app.use(express.json())
    this.app.use(express.urlencoded({ extended: true }))
    // Cobre todas as rotas, inclusive o preflight (OPTIONS)
    this.app.use(cors())

    this.app.use(
      '/images/logos',
      express.static(
        path.join(import.meta.dir, '..', 'assets', 'imgs', 'logos'),
      ),
    )

    this.app.use(
      '/images/avatar',
      express.static(
        path.join(import.meta.dir, '..', 'assets', 'imgs', 'avatar'),
      ),
    )
  }
}

export default new App().app
