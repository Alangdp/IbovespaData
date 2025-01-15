import { Redis as RedisIO } from 'ioredis'

import env from '@/env'

export class Redis {
  // eslint-disable-next-line no-use-before-define
  static instance: Redis | null = null
  static redis: RedisIO

  private constructor() {
    Redis.redis = new RedisIO({
      port: env.REDIS_PORT,
      host: env.REDIS_HOST,
    })
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

  public static saveObjectToCache = async <T>(
    key: string,
    data: T,
  ): Promise<void> => {
    const redis = Redis.getInstance()

    await redis.set(key, JSON.stringify(data))
  }
}
