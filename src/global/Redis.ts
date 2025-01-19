import { Redis as RedisIO } from 'ioredis'

import env from '@/env'

export class Redis {
  // eslint-disable-next-line no-use-before-define
  static instance: Redis | null = null
  static redis: RedisIO
  static expires_channel: RedisIO

  private constructor() {
    Redis.redis = new RedisIO({
      port: env.REDIS_PORT,
      host: env.REDIS_HOST,
    })

    Redis.expires_channel = new RedisIO({
      port: env.REDIS_PORT,
      host: env.REDIS_HOST,
    })

    Redis.expires_channel.subscribe('__keyevent@0__:expired')
  }

  public static getInstance() {
    if (!Redis.instance) {
      Redis.instance = new Redis()
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
    return results
      .filter(([error, value]) => !error && value) // Remove erros e valores nulos
      .map(([_errors, value]) => JSON.parse(value as string) as T) // Converte valores encontrados
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
