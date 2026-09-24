import { Redis as RedisIO } from 'ioredis'

import env from '@/env'

import { STOCK_JOB, stockQueue } from './Queue'

/** Função chamada quando uma chave que casa com o padrão expira */
type EventFunction = (key: string) => Promise<void>

/** Canal em que o Redis publica as chaves expiradas do banco 0 */
const EXPIRED_CHANNEL = '__keyevent@0__:expired'

/** Tempo padrão de vida das chaves gravadas no cache (s) */
const DEFAULT_EXPIRE_SECONDS = 3600

/**
 * Cache em Redis e disparo de funções quando chaves expiram
 *
 * Usa duas conexões: uma para leitura/gravação e outra só para ouvir os
 * eventos de expiração (uma conexão em modo subscribe não aceita outros
 * comandos)
 */
export class Redis {
  private static client: RedisIO | null = null
  /** Funções de expiração por expressão regular da chave */
  private static readonly events = new Map<string, EventFunction[]>()

  /** Retorna a conexão com o Redis, criando as conexões na primeira chamada */
  public static getInstance(): RedisIO {
    // Se as conexões já foram criadas
    if (Redis.client) {
      return Redis.client
    }

    const options = { port: env.REDIS_PORT, host: env.REDIS_HOST }
    Redis.client = new RedisIO(options)

    // Assina os eventos de expiração de chave
    const subscriber = new RedisIO(options)
    subscriber.subscribe(EXPIRED_CHANNEL, (err) => {
      if (err) {
        console.log('Erro ao ativar subscribe', err)
      } else {
        console.log('Subscribe ativado')
      }
    })
    subscriber.on('message', async (_channel, key) => {
      console.log(`Chave expirada: ${key}`)
      await Redis.executeFunctionsForKey(key)
    })

    return Redis.client
  }

  /**
   * Registra uma função para ser chamada quando uma chave que casa com o
   * padrão expirar
   *
   * @param regexKey - Expressão regular da chave (ex.: `^STOCK-`)
   * @param func - Função que recebe a chave expirada
   */
  public static addEvent(regexKey: string, func: EventFunction) {
    const functions = Redis.events.get(regexKey) ?? []
    functions.push(func)
    Redis.events.set(regexKey, functions)
    console.log(
      `Função adicionada para o evento de expiração com regex: ${regexKey}`,
    )
  }

  /** Chama, em ordem, as funções de todos os padrões que casam com a chave */
  private static async executeFunctionsForKey(key: string) {
    for (const [regexKey, functions] of Redis.events) {
      // Se a chave não casa com o padrão
      if (!new RegExp(regexKey).test(key)) {
        continue
      }

      for (const func of functions) {
        try {
          await func(key)
        } catch (err) {
          console.error('Erro ao executar a função do evento:', err)
        }
      }
    }
  }

  /** Retorna o objeto gravado na chave, ou `null` se ela não existir */
  public static async getObjectFromCache<T>(key: string): Promise<T | null> {
    const cachedData = await Redis.getInstance().get(key)
    return cachedData ? JSON.parse(cachedData) : null
  }

  /**
   * Retorna todos os objetos cujas chaves começam com o prefixo
   *
   * Usa `SCAN` em lotes, que não bloqueia o Redis como o `KEYS`
   */
  public static async getAllObjectWithFromCache<T>(
    prefix: string,
  ): Promise<T[]> {
    const redis = Redis.getInstance()

    // Busca as chaves com o prefixo
    const keys: string[] = []
    for await (const batch of redis.scanStream({
      match: `${prefix}*`,
      count: 500,
    })) {
      keys.push(...(batch as string[]))
    }
    // Se nenhuma chave foi encontrada
    if (keys.length === 0) {
      return []
    }

    // Busca os valores de todas as chaves de uma vez e descarta os ausentes
    const values = await redis.mget(keys)
    return values
      .filter((value): value is string => value !== null)
      .map((value) => JSON.parse(value) as T)
  }

  /**
   * Grava o objeto como JSON na chave
   *
   * @param timeExpire - Tempo de vida da chave (s)
   */
  public static async saveObjectToCache<T>(
    key: string,
    data: T,
    timeExpire = DEFAULT_EXPIRE_SECONDS,
  ): Promise<void> {
    await Redis.getInstance().set(key, JSON.stringify(data), 'EX', timeExpire)
  }

  /** Exclui a chave do cache */
  public static async deleteFromCache(key: string): Promise<void> {
    await Redis.getInstance().del(key)
  }

  /**
   * Grava vários objetos de uma vez (um único round-trip ao Redis)
   *
   * @param entries - Pares chave/objeto
   * @param timeExpire - Tempo de vida das chaves (s)
   */
  public static async saveObjectsToCache(
    entries: [string, unknown][],
    timeExpire = DEFAULT_EXPIRE_SECONDS,
  ): Promise<void> {
    const pipeline = Redis.getInstance().pipeline()
    for (const [key, data] of entries) {
      pipeline.set(key, JSON.stringify(data), 'EX', timeExpire)
    }
    await pipeline.exec()
  }
}

// Instancia as conexões na carga do módulo
Redis.getInstance()

// Enfileira a atualização da ação quando o cache dela expira. O padrão casa
// com chaves no formato STOCK-XXXXDD, onde XXXX são letras e DD são dígitos
// (ex.: STOCK-KLBN11, STOCK-PETR4)
Redis.addEvent('^STOCK-[a-zA-Z]{4}\\d{1,2}$', async (key) => {
  const ticker = key.split('-')[1]
  await stockQueue.add(STOCK_JOB, { ticker })
})
