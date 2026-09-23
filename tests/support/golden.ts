import { expect } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Golden files: guardam a saída atual de um bloco de código. Se a saída mudar
// numa refatoração, o teste falha. Para regravar de propósito:
//   UPDATE_GOLDEN=1 bun test

const GOLDEN_DIR = join(import.meta.dir, '..', 'golden', 'data')

// Passa por JSON para o que é comparado ser exatamente o que a API devolve
// (Date vira string ISO, undefined some, instâncias de classe viram objeto).
function normalize<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value))
}

export function expectGolden(name: string, value: unknown) {
  const file = join(GOLDEN_DIR, `${name}.json`)
  const actual = normalize(value)

  if (process.env.UPDATE_GOLDEN || !existsSync(file)) {
    mkdirSync(GOLDEN_DIR, { recursive: true })
    writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`)
    return
  }

  expect(actual).toEqual(JSON.parse(readFileSync(file, 'utf8')))
}
