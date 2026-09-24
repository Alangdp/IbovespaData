import type { CashFlowYear, RootCashFlow } from '../../types/cashFlow.type.js'
import { statusInvestApi } from './http.js'

/**
 * Busca o fluxo de caixa anual, de 2000 até o ano passado
 *
 * @param ticker - Código da ação (ex.: PETR4)
 * @returns Um item por ano com os valores de cada conta, ou `null` se a API
 * falhar ou devolver uma grade inesperada
 */
export async function fetchCashFlow(
  ticker: string,
): Promise<CashFlowYear[] | null> {
  const lastYear = new Date().getFullYear() - 1

  // Busca a grade do fluxo de caixa
  const data = await statusInvestApi<RootCashFlow>(
    `acao/getfluxocaixa?code=${ticker}&range.min=2000&range.max=${lastYear}`,
  )
  // Se a API falhou
  if (!data) {
    return null
  }

  try {
    return parseGrid(data)
  } catch {
    return null
  }
}

/**
 * Converte a grade do statusinvest (linhas = contas, colunas = anos) em uma
 * lista de anos
 */
function parseGrid(data: RootCashFlow): CashFlowYear[] {
  // Carrega os anos a partir das colunas da primeira linha
  const [headerLine, ...lines] = data.data.grid
  const years = headerLine.columns
    .filter((column) => column.name === 'DATA')
    .map(
      (column, index): CashFlowYear => ({
        name: column.value,
        index,
        value: {},
      }),
    )

  // Distribui o valor de cada conta entre os anos
  for (const { gridLineModel } of lines) {
    // Se a linha não tem conta ou valores
    if (gridLineModel?.key === undefined || !gridLineModel.values) {
      continue
    }

    const { key, values } = gridLineModel
    for (const year of years) {
      // Se o ano tem valor para esta conta
      if (values[year.index] !== undefined) {
        year.value[key] = values[year.index]
      }
    }
  }

  return years
}
