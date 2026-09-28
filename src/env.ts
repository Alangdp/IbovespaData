import { z } from 'zod'

/** Variáveis de ambiente aceitas (o Bun carrega o .env automaticamente) */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3000),

  TOLERANCE_TIME_HOURS: z.coerce.number().default(1),
  TOLERANCE_TIME_HOURS_RANKING: z.coerce.number().default(24),

  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_HOST: z.string().default('localhost'),
})

// Valida as variáveis de ambiente
const result = envSchema.safeParse(process.env)
// Se alguma variável é inválida, encerra o processo
if (!result.success) {
  console.log('Invalid environment variables:', result.error.issues)
  process.exit(1)
}

console.log(`Environment variables are valid (${result.data.NODE_ENV})`)

/** Variáveis de ambiente validadas */
const env = result.data
export default env
