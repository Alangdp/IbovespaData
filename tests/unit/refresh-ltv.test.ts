import { describe, expect, test } from 'bun:test'

import { createLtvRefresher } from '../../src/queues/refreshLtv'
import type { LtvRelatorio } from '../../src/useCases/FundoFetcher'

function setup(ltv: LtvRelatorio) {
  const loaded: string[] = []
  const invalidated: string[] = []
  const refresh = createLtvRefresher({
    loadLtv: async (cnpj) => {
      loaded.push(cnpj)
      return ltv
    },
    invalidateFundo: async (ticker) => {
      invalidated.push(ticker)
    },
  })
  return { refresh, loaded, invalidated }
}

const JOB = { data: { cnpj: '11111111000111', ticker: 'TEST11' } }

describe('createLtvRefresher', () => {
  test('LTV encontrado invalida o detalhe do fundo em cache', async () => {
    const ltv = { ltv: 32.5, referencia: '01/08/2026' }
    const { refresh, loaded, invalidated } = setup(ltv)

    await expect(refresh(JOB)).resolves.toEqual(ltv)
    expect(loaded).toEqual(['11111111000111'])
    expect(invalidated).toEqual(['TEST11'])
  })

  test('sem LTV não invalida o cache (o fundo não é raspado de novo)', async () => {
    const { refresh, invalidated } = setup({ ltv: null, referencia: '' })

    await refresh(JOB)

    expect(invalidated).toHaveLength(0)
  })

  test('falha do FNET é relançada (o BullMQ repete) e não invalida', async () => {
    const invalidated: string[] = []
    const refresh = createLtvRefresher({
      loadLtv: async () => {
        throw new Error('FNET indisponível')
      },
      invalidateFundo: async (ticker) => {
        invalidated.push(ticker)
      },
    })

    await expect(refresh(JOB)).rejects.toThrow('FNET indisponível')
    expect(invalidated).toHaveLength(0)
  })
})
