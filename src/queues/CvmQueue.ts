import { Queue, Worker } from 'bullmq'

import { queueConnection } from '@/global/Queue'
import { CvmDataBase } from '@/useCases/cvmDataBase'

/** Nome da fila que atualiza a base de informes da CVM */
export const CVM_QUEUE = 'cvm refresh'
/** Nome do job de atualização */
export const CVM_JOB = 'refresh'

/** Todo dia às 6h (segundo minuto hora dia mês dia-da-semana) */
const DAILY_PATTERN = '0 0 6 * * *'

const cvmDataBase = new CvmDataBase()

/** Fila de atualização da base da CVM */
export const cvmQueue = new Queue(CVM_QUEUE, {
  connection: queueConnection,
  defaultJobOptions: {
    // Falhas de rede na CVM são repetidas: 1min, 2min, 4min
    attempts: 4,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 30 },
  },
})

/** Worker que baixa os informes (só baixa quando a CVM republicou) */
export const cvmWorker = new Worker(
  CVM_QUEUE,
  async () => {
    const result = await cvmDataBase.refresh()
    console.log(
      result.atualizado
        ? `[cvm] base atualizada: ${result.fundos} fundos`
        : '[cvm] sem novidades na CVM',
    )
    return result
  },
  { connection: queueConnection, concurrency: 1 },
)

// Registra os listeners de erro: sem eles o EventEmitter derruba o processo
// quando o Redis fica indisponível
cvmQueue.on('error', (error) => {
  console.error('[cvm] erro na fila:', error.message)
})
cvmWorker.on('error', (error) => {
  console.error('[cvm] erro no worker:', error.message)
})
cvmWorker.on('failed', (job, error) => {
  console.error(
    `[cvm] falha na atualização (tentativa ${job?.attemptsMade}): ${error.message}`,
  )
})

/**
 * Agenda a atualização diária e dispara uma agora, para a base existir logo
 * que o servidor sobe
 */
export async function scheduleCvmRefresh() {
  await cvmQueue.upsertJobScheduler(
    'cvm-diario',
    { pattern: DAILY_PATTERN },
    { name: CVM_JOB },
  )
  await cvmQueue.add(CVM_JOB, {})
}
