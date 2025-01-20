import { createServer } from 'node:http'

import { Server } from 'socket.io'

import app from './app.js'
import env from './env.js'

const port = env.PORT
const httpServer = createServer(app)
export const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
})

httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
