import { describe, expect, test } from 'bun:test'

import { Graham } from '../../src/Entities/Graham'
import type { StockProps } from '../../src/types/stock.types'

const DEBT_RULE = 'Dívida Bruta/Patrimônio inferior a 0.5'

// Ação mínima com só os campos lidos pelo Graham
function makeStock(grossDebt: number, patrimony: number): StockProps {
  const indicator = (actual: number) => ({
    actual,
    olds: [{ value: actual }],
  })
  return {
    ticker: 'TEST3',
    actualPrice: 10,
    actualDividendYield: 0.06,
    grossDebt,
    patrimony,
    netLiquid: [],
    lastDividendsValue: [],
    passiveChart: [{ currentAssets: 2, currentLiabilities: 1 }],
    indicators: {
      p_l: indicator(8),
      p_vp: indicator(1),
      roe: indicator(15),
      lpa: indicator(2),
      vpa: indicator(10),
    },
  } as unknown as StockProps
}

function debtRuleScored(grossDebt: number, patrimony: number) {
  const pontuation = new Graham(
    makeStock(grossDebt, patrimony),
    0.1,
  ).makePoints()
  return pontuation.totalEvaluate.find((rule) => rule.ruleName === DEBT_RULE)
    ?.scored
}

describe('Graham: Dívida Bruta/Patrimônio', () => {
  test('pontua quando a dívida é menor que metade do patrimônio', () => {
    expect(debtRuleScored(40, 100)).toBe(true)
  })

  test('não pontua quando a dívida passa de metade do patrimônio', () => {
    expect(debtRuleScored(60, 100)).toBe(false)
  })

  test('patrimônio negativo não pontua (a razão negativa passaria)', () => {
    expect(debtRuleScored(40, -100)).toBe(false)
  })

  test('patrimônio zero não pontua', () => {
    expect(debtRuleScored(0, 0)).toBe(false)
    expect(debtRuleScored(40, 0)).toBe(false)
  })
})
