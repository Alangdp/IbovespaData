import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import axios, { AxiosError } from 'axios'

// Fixtures HTTP: grava (record) ou reproduz (replay) as respostas das fontes
// externas (statusinvest, fundamentus...) pelo adapter do axios, para que os
// testes rodem offline e de forma determinística.

interface Recorded {
  status: number
  data: string
}

type FixtureSet = Record<string, Recorded>

export const FIXTURE_FILE = join(
  import.meta.dir,
  '..',
  'fixtures',
  'http',
  'recorded.json.gz',
)

type RequestConfig = Parameters<typeof axios.getUri>[0] & {
  method?: string
  data?: unknown
}

// A serialização da query muda entre versões do axios (ex.: `currences[]` vs
// `currences%5B%5D`). Normalizar (decodifica e ordena os parâmetros) evita
// invalidar as fixtures gravadas a cada upgrade.
function normalizeUri(uri: string): string {
  const url = new URL(uri)
  const query = [...url.searchParams]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`
}

function normalizeKey(key: string): string {
  const [head, ...body] = key.split(' | ')
  const [method, uri] = head.split(' ')
  return `${method} ${normalizeUri(uri)}${body.length ? ` | ${body.join(' | ')}` : ''}`
}

function requestKey(config: RequestConfig): string {
  const method = (config.method ?? 'get').toUpperCase()
  const body =
    config.data === undefined
      ? ''
      : typeof config.data === 'string'
        ? config.data
        : JSON.stringify(config.data)
  return normalizeKey(
    `${method} ${axios.getUri(config)}${body ? ` | ${body}` : ''}`,
  )
}

function toText(data: unknown): string {
  return typeof data === 'string' ? data : JSON.stringify(data)
}

function loadSet(): FixtureSet {
  if (!existsSync(FIXTURE_FILE)) {
    return {}
  }
  const raw: FixtureSet = JSON.parse(
    new TextDecoder().decode(
      Bun.gunzipSync(new Uint8Array(readFileSync(FIXTURE_FILE))),
    ),
  )
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [normalizeKey(key), value]),
  )
}

export function saveSet(set: FixtureSet) {
  mkdirSync(dirname(FIXTURE_FILE), { recursive: true })
  writeFileSync(FIXTURE_FILE, Bun.gzipSync(JSON.stringify(set)))
}

// Passa a reproduzir as respostas gravadas. Uma requisição sem fixture falha
// de forma explícita, evitando qualquer acesso real à rede nos testes.
export function replayFixtures() {
  const set = loadSet()

  axios.defaults.adapter = async (config) => {
    const key = requestKey(config)
    const hit = set[key]
    if (!hit) {
      // Loga além de lançar: os clientes (ApiGetter) engolem o erro e devolvem null
      console.error(`Fixture HTTP ausente para: ${key}`)
      throw new Error(`Fixture HTTP ausente para: ${key}`)
    }

    const response = {
      data: hit.data,
      status: hit.status,
      statusText: String(hit.status),
      headers: {},
      config,
      request: {},
    }

    if (hit.status >= 200 && hit.status < 300) {
      return response
    }

    throw new AxiosError(
      `Request failed with status code ${hit.status}`,
      AxiosError.ERR_BAD_REQUEST,
      config,
      {},
      response,
    )
  }
}

// Passa a gravar as respostas reais. Chame o `save()` retornado no final.
export function recordFixtures() {
  const set = loadSet()
  const realAdapter = axios.getAdapter('http')

  axios.defaults.adapter = async (config) => {
    const key = requestKey(config)
    try {
      const response = await realAdapter(config)
      set[key] = { status: response.status, data: toText(response.data) }
      return response
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        set[key] = {
          status: error.response.status,
          data: toText(error.response.data),
        }
      }
      throw error
    }
  }

  return { save: () => saveSet(set), size: () => Object.keys(set).length }
}
