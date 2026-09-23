import axios from 'axios'

import env from '../env.js'
import type {
  BrapiDividendsResponse,
  BrapiHistoricalResponse,
  BrapiIndicatorsResponse,
  BrapiListResponse,
  BrapiPropertiesResponse,
  BrapiReportsResponse,
} from '../types/Brapi.type.js'

// Cliente para https://brapi.dev/docs/fiis
// Os endpoints /api/v2/fii/* são do plano Pro: sem BRAPI_TOKEN configurado,
// só respondem para os símbolos de sandbox MXRF11 e HGLG11.
// Cada chamada aceita até 20 símbolos separados por vírgula.

const MAX_SYMBOLS_PER_CALL = 20

function authHeaders() {
  return env.BRAPI_TOKEN ? { Authorization: `Bearer ${env.BRAPI_TOKEN}` } : {}
}

// Uma chamada que falha (símbolo sem dado, plano insuficiente, timeout etc.)
// não deve derrubar a montagem do resto do Fundo: devolve null e quem chamou
// decide o que fazer com a ausência daquele pedaço de dado.
async function safeGet<T>(
  path: string,
  params: Record<string, unknown>,
): Promise<T | null> {
  try {
    const { data } = await axios.get<T>(`${env.BRAPI_BASE_URL}${path}`, {
      params,
      headers: authHeaders(),
      timeout: 15000,
    })
    return data
  } catch (error) {
    return null
  }
}

export const Brapi = {
  maxSymbolsPerCall: MAX_SYMBOLS_PER_CALL,

  list: (params: Record<string, unknown> = {}) =>
    safeGet<BrapiListResponse>('/list', params),

  indicators: (symbols: string[]) =>
    safeGet<BrapiIndicatorsResponse>('/indicators', {
      symbols: symbols.join(','),
    }),

  dividends: (symbols: string[], params: Record<string, unknown> = {}) =>
    safeGet<BrapiDividendsResponse>('/dividends', {
      symbols: symbols.join(','),
      sortOrder: 'asc',
      ...params,
    }),

  properties: (symbols: string[]) =>
    safeGet<BrapiPropertiesResponse>('/properties', {
      symbols: symbols.join(','),
    }),

  reports: (symbols: string[]) =>
    safeGet<BrapiReportsResponse>('/reports', {
      symbols: symbols.join(','),
      limit: symbols.length,
    }),

  historical: (symbols: string[], params: Record<string, unknown> = {}) =>
    safeGet<BrapiHistoricalResponse>('/historical', {
      symbols: symbols.join(','),
      ...params,
    }),
}
