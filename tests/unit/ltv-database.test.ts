import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { FnetDocumento } from '../../src/sources/fnet'

// Troca o Redis e o FNET por doubles em memória: o LtvDataBase só grava e lê
// o cache e baixa o relatório, sem regra própria de rede.

const saved = new Map<string, { data: unknown; ttl?: number }>()
let documento: FnetDocumento | null = null
let texto = ''

mock.module('../../src/global/Redis', () => ({
  Redis: {
    getInstance: () => ({}),
    addEvent: () => {},
    getObjectFromCache: async (key: string) => saved.get(key)?.data ?? null,
    getAllObjectWithFromCache: async () => [],
    saveObjectToCache: async (key: string, data: unknown, ttl?: number) => {
      saved.set(key, { data, ttl })
    },
    deleteFromCache: async (key: string) => {
      saved.delete(key)
    },
  },
}))
mock.module('../../src/sources/fnet', () => ({
  fetchLatestRelatorioGerencial: async () => documento,
  fetchDocumentoTexto: async () => texto,
}))

const { LtvDataBase } = await import('../../src/useCases/ltvDataBase')

const CNPJ = '11111111000111'
const KEY = `FNET-LTV-${CNPJ}`

beforeEach(() => {
  saved.clear()
  documento = null
  texto = ''
})

describe('LtvDataBase.load', () => {
  test('sem relatório gerencial grava o marcador sem LTV', async () => {
    const db = new LtvDataBase()

    const ltv = await db.load(CNPJ)

    expect(ltv).toEqual({ ltv: null, referencia: '' })
    expect(saved.get(KEY)?.data).toEqual(ltv)
    expect(saved.get(KEY)?.ttl).toBeGreaterThan(0)
    // O marcador impede que o findLtv enfileire a leitura de novo
    expect(await db.getCached(CNPJ)).toEqual(ltv)
  })

  test('com relatório extrai o LTV do texto e grava no cache', async () => {
    documento = { id: 1, dataReferencia: '31/07/2026' }
    texto = 'Book de CRIs LTV médio 56% *Considerando o MtM'
    const db = new LtvDataBase()

    const ltv = await db.load(CNPJ)

    expect(ltv).toEqual({ ltv: 56, referencia: '31/07/2026' })
    expect(saved.get(KEY)?.data).toEqual(ltv)
  })
})
