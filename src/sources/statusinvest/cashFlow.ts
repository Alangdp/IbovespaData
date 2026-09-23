import type { RootCashFlow } from '../../types/cashFlow.type.js'
import type { Header } from '../../types/get.type.js'
import { statusInvestApi } from './http.js'

// Fluxo de caixa anual, de 2000 até o ano passado, reorganizado como uma lista
// de anos (`Header`), cada um com os valores por chave (ex.: lucro líquido).
// Devolve null se a API falhar.
// TODO: a estrutura devolvida pelo statusinvest é uma grade; vale trocar por
// um formato mais direto (ano -> chave -> valor) quando o consumo mudar.
export async function fetchCashFlow(ticker: string): Promise<Header[] | null> {
  const lastYear = new Date().getFullYear() - 1

  try {
    const data = await statusInvestApi<RootCashFlow>(
      { method: 'GET', headers: {} },
      `getfluxocaixa?code=${ticker}&range.min=${2000}&range.max=${lastYear}`,
    )
    if (!data) throw new Error('Error Getting CashFlow Data')

    const grid = data.data.grid

    const years: string[] = grid[0].columns
      .map((column) => (column.name === 'DATA' ? column.value : undefined))
      .filter((year): year is string => year !== undefined)

    const header: Header[] = years.map((year, index) => ({
      name: year,
      index,
      value: {},
    }))

    for (const line of grid.slice(1)) {
      const gridLineModel = line.gridLineModel
      if (gridLineModel === undefined) continue

      const key = gridLineModel.key
      const values = gridLineModel.values as (number | undefined)[] | undefined
      if (key === undefined || values === undefined) continue

      header.forEach((item, index) => {
        if (values[index] === undefined) return
        item.value[key] = values[index] as number
      })
    }

    return header
  } catch (error) {
    return null
  }
}
