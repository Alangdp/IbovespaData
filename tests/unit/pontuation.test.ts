import { describe, expect, test } from 'bun:test'

import { Pontuation } from '../../src/Entities/Pontuation'

function makePontuation(defaultIfTrue = 1, defaultIfFalse = 1) {
  return new Pontuation({
    id: 'TEST3',
    subId: 'BAZIN',
    defaultIfTrue,
    defaultIfFalse,
    totalPoints: 0,
    totalEvaluate: [],
    infoData: { actualPrice: 10, maxPrice: 20, dy: 0.06 },
  })
}

describe('Pontuation', () => {
  test('regra verdadeira soma ifTrue e marca scored', () => {
    const p = makePontuation()
    p.addRule({ ruleName: 'a', rule: true, ifTrue: 3, ifFalse: 2 })
    p.calculate()

    expect(p.totalPoints).toBe(3)
    expect(p.totalEvaluate[0].scored).toBe(true)
  })

  test('regra falsa subtrai ifFalse e marca scored=false', () => {
    const p = makePontuation()
    p.addRule({ ruleName: 'a', rule: false, ifTrue: 3, ifFalse: 2 })
    p.calculate()

    expect(p.totalPoints).toBe(-2)
    expect(p.totalEvaluate[0].scored).toBe(false)
  })

  test('sem ifTrue/ifFalse usa os defaults do construtor', () => {
    const p = makePontuation(5, 4)
    p.addRule({ ruleName: 'ok', rule: true })
    p.addRule({ ruleName: 'nok', rule: false })
    p.calculate()

    expect(p.totalPoints).toBe(5 - 4)
  })

  test('ifTrue/ifFalse iguais a 0 caem no default (0 é falsy no código atual)', () => {
    const p = makePontuation(1, 1)
    p.addRule({ ruleName: 'ok', rule: true, ifTrue: 0 })
    p.addRule({ ruleName: 'nok', rule: false, ifFalse: 0 })
    p.calculate()

    expect(p.totalPoints).toBe(0)
  })

  test('acumula várias regras', () => {
    const p = makePontuation()
    p.addRule({ ruleName: '1', rule: true, ifTrue: 2 })
    p.addRule({ ruleName: '2', rule: true, ifTrue: 2 })
    p.addRule({ ruleName: '3', rule: false, ifFalse: 4 })
    p.calculate()

    expect(p.totalPoints).toBe(0)
  })
})
