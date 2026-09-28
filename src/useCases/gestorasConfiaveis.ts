import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { cnpjDigits } from '../sources/cvm/build.js'

/** Lista mantida à mão; o CNPJ identifica a gestora, o nome é só referência */
const FILE = path.join(
  import.meta.dir,
  '..',
  '..',
  'data',
  'gestoras-confiaveis.json',
)

interface GestorasFile {
  gestoras: { cnpj: string; nome?: string }[]
}

let cache: { mtimeMs: number; cnpjs: Set<string> } | null = null

/**
 * Lê os CNPJs do arquivo, relendo só quando ele muda (dá para editar a lista
 * com o servidor rodando)
 *
 * @returns Conjunto vazio se o arquivo não existir ou for inválido
 */
function loadCnpjs(): Set<string> {
  try {
    const { mtimeMs } = statSync(FILE)
    // Se o arquivo não mudou desde a última leitura
    if (cache?.mtimeMs === mtimeMs) {
      return cache.cnpjs
    }
    const file = JSON.parse(readFileSync(FILE, 'utf8')) as GestorasFile
    const cnpjs = new Set(
      (file.gestoras ?? []).map((gestora) => cnpjDigits(gestora.cnpj)),
    )
    cache = { mtimeMs, cnpjs }
    return cnpjs
  } catch (error) {
    console.error(
      '[gestoras] erro ao ler data/gestoras-confiaveis.json:',
      (error as Error).message,
    )
    return new Set()
  }
}

/**
 * Verifica se a gestora está na lista de confiáveis
 *
 * @param cnpj - CNPJ da gestora (com ou sem pontuação)
 * @returns `null` sem CNPJ ou com a lista vazia (ainda não configurada)
 */
export function isGestoraConfiavel(cnpj: string | null): boolean | null {
  const cnpjs = loadCnpjs()
  // Se o fundo não tem gestora ou a lista não foi preenchida
  if (!cnpj || cnpjs.size === 0) {
    return null
  }
  return cnpjs.has(cnpjDigits(cnpj))
}
