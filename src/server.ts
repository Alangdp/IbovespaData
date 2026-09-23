import app from './app.js'
import env from './env.js'
import { stockQueue } from './global/Queue.js'
import { stockWorker } from './queues/StockQueue.js'

const port = env.PORT
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})

// Encerramento limpo (docker stop, deploy, Ctrl+C): para de aceitar requisições
// e deixa o worker terminar o job em andamento em vez de marcá-lo como travado.
async function shutdown(signal: string) {
  console.log(`${signal} recebido, encerrando...`)
  server.close()
  await stockWorker.close()
  await stockQueue.close()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
