import { Redis as RedisIO } from 'ioredis'

import env from '@/env'

import { stockQueue } from './Queue'

type EventFunction = (key: string) => Promise<void>

export class Redis {
  // eslint-disable-next-line no-use-before-define
  static instance: Redis | null = null
  static redis: RedisIO
  static subcribe: RedisIO
  static events: { [key: string]: EventFunction[] } = {}

  private constructor() {
    Redis.redis = new RedisIO({
      port: env.REDIS_PORT,
      host: env.REDIS_HOST,
    })

    Redis.subcribe = new RedisIO({
      port: env.REDIS_PORT,
      host: env.REDIS_HOST,
    })

    // Ativar a assinatura para eventos de expiração
    Redis.subcribe.subscribe('__keyevent@0__:expired')
  }

  private static activeSubcribe(subscriber: RedisIO) {
    subscriber.subscribe('__keyevent@0__:expired', (err) => {
      if (err) {
        console.log('Erro ao ativar subscribe', err)
      } else {
        console.log('Subscribe ativado')
      }
    })

    subscriber.on('message', async (channel, message) => {
      console.log(`Evento de expiração recebido no canal ${channel}:`)
      console.log(`Chave expirada: ${message}`)

      // Executa as funções associadas ao padrão de chave
      await Redis.executeFunctionsForKey(message)
    })
  }

  public static addEvent(
    regexKey: string,
    func: (key: string) => Promise<void>,
  ) {
    Redis.saveObjectToCache('STOCK-BBAS3', { ticker: 'TESTE' })

    // Adicionar a função à lista de funções associadas ao padrão de chave
    if (!Redis.events[regexKey]) {
      Redis.events[regexKey] = []
    }

    Redis.events[regexKey]?.push(func)
    console.log(
      `Função adicionada para o evento de expiração com regex: ${regexKey}`,
    )
  }

  private static async executeFunctionsForKey(key: string) {
    // Verifica todas as funções associadas aos padrões de chave
    for (const regexKey in Redis.events) {
      if (new RegExp(regexKey).test(key)) {
        // Verifica se a chave corresponde ao padrão regex
        const functions = Redis.events[regexKey]
        for (const func of functions) {
          try {
            await func(key) // Executa a função associada
          } catch (err) {
            console.error('Erro ao executar a função do evento:', err)
          }
        }
      }
    }
  }

  public static getInstance() {
    if (!Redis.instance) {
      Redis.instance = new Redis()
      Redis.activeSubcribe(Redis.subcribe)
    }

    return Redis.redis
  }

  public static getObjectFromCache = async <T>(
    key: string,
  ): Promise<T | null> => {
    const redis = Redis.getInstance()
    const cachedData = await redis.get(key)
    return cachedData ? JSON.parse(cachedData) : null
  }

  public static getAllObjectWithFromCache = async <T>(
    prefix: string,
  ): Promise<T[]> => {
    const redis = Redis.getInstance()

    // Busca todas as chaves que começam com o prefixo
    const keys = await redis.keys(`${prefix}*`)

    if (!keys || keys.length === 0) {
      return []
    }

    // Utiliza pipeline para buscar valores de todas as chaves
    const pipeline = redis.pipeline()
    keys.forEach((key) => pipeline.get(key))
    const results = await pipeline.exec()
    if (!results) return []

    // Filtra valores válidos e parseia os resultados encontrados
    return (
      results
        .filter(([error, value]) => !error && value) // Remove erros e valores nulos
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(([_errors, value]) => JSON.parse(value as string) as T)
    ) // Converte valores encontrados
  }

  public static saveObjectToCache = async <T>(
    key: string,
    data: T,
    timeExpire?: number,
  ): Promise<void> => {
    const redis = Redis.getInstance()
    await redis.set(key, JSON.stringify(data), 'EX', timeExpire || 3600)
  }
}

// Instancia inicial
Redis.getInstance()

// Evento de expiração de chave de ações
// O padrão abaixo se refere a ações no formato STOCK-XXXXDD
// Onde XXXX são letras e DD são dígitos
// Exemplo: STOCK-KLBN11
// Exemplo: STOCK-PETR4
Redis.addEvent('^STOCK-[a-zA-z]{4}\\d{1,2}$', async (key) => {
  const ticker = key.split('-')[1]
  stockQueue.add({ ticker })
})
