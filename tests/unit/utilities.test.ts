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

  test('milhar com ponto e decimal com vírgula', () => {
    expect(Utilities.formateNumber('58.671,52m²')).toBe(58671.52)
    expect(Utilities.formateNumber('R$ 7.589.554.105')).toBe(7589554105)
  })

  test('mantém o sinal negativo', () => {
    expect(Utilities.formateNumber('-0,19%')).toBe(-0.19)
  })

  test('texto sem dígitos vira 0', () => {
    expect(Utilities.formateNumber('-')).toBe(0)
    expect(Utilities.formateNumber('')).toBe(0)
  })
})
