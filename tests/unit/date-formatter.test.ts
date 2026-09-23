import { describe, expect, test } from 'bun:test'

import { DateFormatter } from '../../src/utils/DateFormater'

describe('DateFormatter', () => {
  test('dateToString formata dd/mm/yyyy com zero à esquerda', () => {
    expect(DateFormatter.dateToString(new Date(2025, 0, 5))).toBe('05/01/2025')
    expect(DateFormatter.dateToString(new Date(2025, 11, 31))).toBe(
      '31/12/2025',
    )
  })

  test('stringToDate lê dd/mm/yyyy', () => {
    const date = DateFormatter.stringToDate('05/01/2025')!
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([
      2025, 0, 5,
    ])
  })

  test('stringToDate ignora o sufixo "00:00"', () => {
    const date = DateFormatter.stringToDate('05/01/2025 00:00')!
    expect(DateFormatter.dateToString(date)).toBe('05/01/2025')
  })

  test('stringToDate com ano de 2 dígitos soma 2000', () => {
    const date = DateFormatter.stringToDate('05/01/25')!
    expect(date.getFullYear()).toBe(2025)
  })

  test('stringToDate devolve null para formato inválido', () => {
    expect(DateFormatter.stringToDate('2025-01-05')).toBeNull()
    expect(DateFormatter.stringToDate('aa/bb/cccc')).toBeNull()
  })
})
