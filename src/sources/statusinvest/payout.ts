import type { PayoutReturn, RootPayout } from '../../types/Payout.type.js'
import { statusInvestApi } from './http.js'

/**
 * Busca o payout atual, médio, mínimo e máximo
 *
 * @param ticker - Código da ação (ex.: PETR4)
 * @returns O payout, ou `null` se a API falhar
 */
export async function fetchPayout(
  ticker: string,
): Promise<PayoutReturn | null> {
  // Busca o payout
  const data = await statusInvestApi<RootPayout>(
    `acao/payoutresult?code=${ticker}`,
  )
  // Se a API falhou
  if (!data) {
    return null
  }

  return {
    actual: data.actual,
    // Presume o payout atual quando não há média
    average: data.avg ?? data.actual,
    minValue: data.minValue,
    maxValue: data.maxValue,
    chart: data.chart,
  }
}
