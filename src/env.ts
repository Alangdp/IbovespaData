import { z } from 'zod'

// O Bun carrega o .env automaticamente (não precisa de dotenv)
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3000),

  TOLERANCE_TIME_HOURS: z.coerce.number().default(1),
  TOLERANCE_TIME_HOURS_RANKING: z.coerce.number().default(24),

  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_HOST: z.string().default('localhost'),

  // Fonte de dados dos fundos imobiliários (rotas /fundos).
  // Sem token, a brapi.dev só responde para os tickers de sandbox
  // MXRF11 e HGLG11. Para os demais FIIs é necessário um token do plano Pro
  // (https://brapi.dev/dashboard). Ver useCases/BrapiClient.ts.
  BRAPI_TOKEN: z.string().default(''),
  BRAPI_BASE_URL: z.string().default('https://brapi.dev/api/v2/fii'),
})

let env: z.infer<typeof envSchema>

try {
  env = envSchema.parse(process.env)
  // Não loga o objeto inteiro: ele inclui o BRAPI_TOKEN
  console.log(`Environment variables are valid (${env.NODE_ENV})`)
} catch (error: unknown) {
  if (error instanceof z.ZodError) {
    console.log('Invalid environment variables:', error.issues)
  } else {
    console.log('Unexpected error:', error)
  }
  process.exit(1)
}

export default env
