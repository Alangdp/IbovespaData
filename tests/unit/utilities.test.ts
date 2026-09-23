import { describe, expect, test } from 'bun:test'

import Utilities from '../../src/utils/Utilities'

describe('Utilities.formateNumber', () => {
  test('número em formato brasileiro', () => {
    expect(Utilities.formateNumber('12,5')).toBe(12.5)
    expect(Utilities.formateNumber('R$ 12,50')).toBe(12.5)
    expect(Utilities.formateNumber('7,39%')).toBe(7.39)
  })

  test('vários pontos de milhar viram inteiro', () => {
    expect(Utilities.formateNumber('1.234.567')).toBe(1234567)
  })

  test('texto sem dígitos vira 0', () => {
    expect(Utilities.formateNumber('-')).toBe(0)
    expect(Utilities.formateNumber('')).toBe(0)
  })
})
