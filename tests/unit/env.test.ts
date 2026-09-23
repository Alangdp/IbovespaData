import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

// src/env.ts valida process.env ao ser importado e encerra o processo se algo
// estiver inválido; por isso cada caso roda em um processo separado.
const ROOT = join(import.meta.dir, '..', '..')

function importEnv(env: Record<string, string>) {
  const result = Bun.spawnSync({
    cmd: [
      process.execPath,
      '-e',
      "import env from './src/env'; console.log(JSON.stringify(env))",
    ],
    cwd: ROOT,
    // Ambiente mínimo: não herda REDIS_*/PORT/etc. da máquina
    env: { PATH: process.env.PATH ?? '', ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
  }
}

describe('src/env.ts', () => {
  test('usa os valores padrão quando nada é informado', () => {
    const { exitCode, stdout } = importEnv({})
    expect(exitCode).toBe(0)

    const env = JSON.parse(stdout.trim().split('\n').at(-1)!)
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      TOLERANCE_TIME_HOURS: 1,
      TOLERANCE_TIME_HOURS_RANKING: 24,
      BRAPI_TOKEN: '',
    })
  })

  test('converte números vindos como string', () => {
    const { exitCode, stdout } = importEnv({ PORT: '4000', REDIS_PORT: '6380' })
    expect(exitCode).toBe(0)

    const env = JSON.parse(stdout.trim().split('\n').at(-1)!)
    expect(env.PORT).toBe(4000)
    expect(env.REDIS_PORT).toBe(6380)
  })

  test('valor inválido encerra o processo com código 1', () => {
    const { exitCode, stdout } = importEnv({ PORT: 'abc' })

    expect(exitCode).toBe(1)
    expect(stdout).toContain('Invalid environment variables')
  })

  test('NODE_ENV fora da lista encerra o processo com código 1', () => {
    expect(importEnv({ NODE_ENV: 'staging' }).exitCode).toBe(1)
  })

  test('não imprime o BRAPI_TOKEN no log', () => {
    const { stdout } = importEnv({ BRAPI_TOKEN: 'segredo-super-secreto' })

    expect(stdout).toContain('Environment variables are valid')
    // o JSON final do teste contém o token; o log de startup, não
    expect(stdout.split('\n')[0]).not.toContain('segredo-super-secreto')
  })
})
