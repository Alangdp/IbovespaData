import type {
  PassiveChart,
  PassiveChartReturn,
} from '../../types/PassiveChart.type.js'
import { statusInvestApi } from './http.js'

// Balanço patrimonial (ativos/passivos por ano). Devolve null se a API falhar.
export async function fetchPassiveChart(
  ticker: string,
): Promise<PassiveChartReturn[] | null> {
  try {
    const data = await statusInvestApi<PassiveChart[]>(
      { method: 'GET', headers: {} },
      `getbsactivepassivechart?code=${ticker}&type=1`,
    )
    if (!data) throw new Error('Error Getting Passive Chart Data')

    return data.map((item) => ({
      year: item.year,
      totalAssets: item.ativoTotal,
      totalLiabilities: item.passivoTotal,
      currentAssets: item.ativoCirculante,
      nonCurrentAssets: item.ativoNaoCirculante,
      currentLiabilities: item.passivoCirculante,
      nonCurrentLiabilities: item.passivoNaoCirculante,
      shareholdersEquity: item.patrimonioLiquido,
    }))
  } catch (error) {
    return null
  }
}
