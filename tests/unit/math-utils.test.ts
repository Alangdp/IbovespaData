import { describe, expect, test } from 'bun:test'

import MathUtils from '../../src/utils/MathUtils'

describe('MathUtils', () => {
  test('makeAverage', () => {
    expect(MathUtils.makeAverage([2, 4, 6])).toBe(4)
    expect(MathUtils.makeAverage([0.06, 0.08])).toBeCloseTo(0.07)
  })

  test('makeAverage de lista vazia é NaN', () => {
    expect(MathUtils.makeAverage([])).toBeNaN()
  })

  test('makeMedian com quantidade ímpar e par', () => {
    expect(MathUtils.makeMedian([0.3, 0.1, 0.2])).toBe(0.2)
    expect(MathUtils.makeMedian([0.4, 0.1, 0.3, 0.2])).toBeCloseTo(0.25)
  })

  // Bug conhecido: makeMedian usa `.sort()` sem comparador (ordem
  // lexicográfica) e ordena o array recebido no lugar. Com números >= 10 o
  // resultado é errado. Quando for corrigido este teste passa a falhar e
  // deve virar `test`.
  test.failing('makeMedian ordena numericamente', () => {
    expect(MathUtils.makeMedian([10, 9, 100])).toBe(10)
  })

  test('abbreviateNumber', () => {
    expect(MathUtils.abbreviateNumber(1500)).toBe('2K')
    expect(MathUtils.abbreviateNumber(2_000_000)).toBe('2M')
    expect(MathUtils.abbreviateNumber(3_500_000_000)).toBe('4B')
  })

  test('abbreviateNumber devolve string vazia abaixo de 1000', () => {
    expect(MathUtils.abbreviateNumber(999)).toBe('')
  })
})
