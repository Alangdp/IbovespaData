import { createClient } from 'redis'

export async function setupRedis() {
  const client = createClient().on('error', (err: unknown) =>
    console.log('Redis Client Error', err),
  )

  await client.connect()
  return client
}
