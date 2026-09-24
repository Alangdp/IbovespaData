import { Queue } from 'bullmq'

import env from '@/env'

/** Dados de um job da fila de atualização de ações */
export interface stockQueueData {
  ticker: string
}

/** Nome da fila de atualização de ações */
export const STOCK_QUEUE = 'stock get'
/** Nome do job que atualiza o cache de uma ação */
export const STOCK_JOB = 'refresh'

/** Conexão do BullMQ (ele abre as próprias conexões a partir destas opções) */
export const queueConnection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
}

/** Dados de um job da fila de leitura do LTV */
export interface ltvQueueData {
  /** CNPJ do fundo, só dígitos */
  cnpj: string
  ticker: string
}

/** Nome da fila que lê o LTV médio dos relatórios gerenciais */
export const LTV_QUEUE = 'fnet ltv'
/** Nome do job que lê o LTV de um fundo */
export const LTV_JOB = 'load'

/** Fila de atualização do cache das ações */
export const stockQueue = new Queue<stockQueueData>(STOCK_QUEUE, {
  connection: queueConnection,
  defaultJobOptions: {
    // Falhas transitórias (rede, bloqueio 403 do statusinvest) são repetidas
    // com espera crescente: 30s, 1min, 2min, 4min
    attempts: 5,
    backoff: { type: 'exponential', delay: 30_000 },
    // Sem isso os jobs concluídos/falhos se acumulam para sempre no Redis
    removeOnComplete: { age: 60 * 60 },
    removeOnFail: { age: 24 * 60 * 60 },
  },
})

// Registra o listener de erro: sem ele o EventEmitter derruba o processo
// quando o Redis fica indisponível
stockQueue.on('error', (error) => {
  console.error('[stockQueue] erro:', error.message)
})

/** Fila de leitura do LTV (o FNET é lento demais para o caminho da requisição) */
export const ltvQueue = new Queue<ltvQueueData>(LTV_QUEUE, {
  connection: queueConnection,
  defaultJobOptions: {
    // O FNET oscila: repete com espera de 1min, 2min
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    // Jobs guardados servem para não enfileirar o mesmo fundo de novo
    // (jobId por CNPJ) enquanto estiverem no Redis
    removeOnComplete: { age: 60 * 60 },
    removeOnFail: { age: 24 * 60 * 60 },
  },
})

ltvQueue.on('error', (error) => {
  console.error('[ltvQueue] erro:', error.message)
})
