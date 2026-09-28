import path from 'node:path'
import cors from 'cors'
import express from 'express'

import bazinRoutes from './routes/bazin.routes.js'
import fundoRoutes from './routes/fundo.routes.js'
import grahamRoutes from './routes/graham.routes.js'
import simulationRoutes from './routes/simulation.routes.js'
import stockRoutes from './routes/stock.routes.js'

const IMAGES_DIR = path.join(import.meta.dir, '..', 'assets', 'imgs')

/** Aplicação Express com middlewares, imagens estáticas e rotas */
const app = express()

// Registra os middlewares; o cors cobre todas as rotas, inclusive o
// preflight (OPTIONS)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())

// Serve os logos e avatares das empresas
app.use('/images/logos', express.static(path.join(IMAGES_DIR, 'logos')))
app.use('/images/avatar', express.static(path.join(IMAGES_DIR, 'avatar')))

// Registra as rotas
app.use('/', stockRoutes)
app.use('/', bazinRoutes)
app.use('/', grahamRoutes)
app.use('/', simulationRoutes)
app.use('/', fundoRoutes)

export default app
