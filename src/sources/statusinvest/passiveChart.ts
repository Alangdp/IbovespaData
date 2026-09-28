import type {
  PassiveChart,
  PassiveChartReturn,
} from '../../types/PassiveChart.type.js'
import { statusInvestApi } from './http.js'

/**
 * Busca o balanço patrimonial (ativos e passivos por ano)
 *
 * @param ticker - Código da ação (ex.: PETR4)
 * @returns Um item por ano, ou `null` se a API falhar
 */
export async function fetchPassiveChart(
  ticker: string,
): Promise<PassiveChartReturn[] | null> {
  // Busca o balanço
  const data = await statusInvestApi<PassiveChart[]>(
    `acao/getbsactivepassivechart?code=${ticker}&type=1`,
  )
  // Se a API falhou ou não devolveu uma lista
  if (!Array.isArray(data)) {
    return null
  }

  // Retorna o balanço com os nomes de campo da aplicação
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
}
