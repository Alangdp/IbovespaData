import app from './app.js'
import env from './env.js'
import { stockQueue } from './global/Queue.js'
import { cvmQueue, cvmWorker, scheduleCvmRefresh } from './queues/CvmQueue.js'
import { ltvWorker } from './queues/LtvQueue.js'
import { stockWorker } from './queues/StockQueue.js'

// Inicia o servidor HTTP
const port = env.PORT
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})

// Agenda a atualização da base de informes da CVM
scheduleCvmRefresh().catch((error) => {
  console.error('[cvm] erro ao agendar a atualização:', error.message)
})

/**
 * Encerramento limpo (docker stop, deploy, Ctrl+C): para de aceitar
 * requisições e deixa o worker terminar o job em andamento em vez de
 * marcá-lo como travado
 */
async function shutdown(signal: string) {
  console.log(`${signal} recebido, encerrando...`)
  server.close()
  await stockWorker.close()
  await stockQueue.close()
  await cvmWorker.close()
  await cvmQueue.close()
  await ltvWorker.close()
  process.exit(0)
}

// Registra o encerramento limpo nos sinais de parada
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
