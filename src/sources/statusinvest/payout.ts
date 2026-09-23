import type { PayoutReturn, RootPayout } from '../../types/Payout.type.js'
import { statusInvestApi } from './http.js'

// Payout atual/médio/mínimo/máximo. Devolve null se a API falhar.
export async function fetchPayout(
  ticker: string,
): Promise<PayoutReturn | null> {
  try {
    const data = await statusInvestApi<RootPayout>(
      { method: 'GET', headers: {}, params: { code: ticker, type: 1 } },
      `payoutresult?code=${ticker}`,
    )
    if (!data) throw new Error('Error Getting Payout Data')

    return {
      actual: data.actual,
      // FIXME: `|` é OR bit a bit (trunca para inteiro); a intenção provável
      // era `||`. Mantido porque mudar altera o payout salvo e as pontuações.
      average: data.avg | data.actual,
      minValue: data.minValue,
      maxValue: data.maxValue,
      chart: data.chart,
    }
  } catch (error) {
    return null
  }
}
