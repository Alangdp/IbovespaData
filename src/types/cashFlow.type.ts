/** Resposta de `getfluxocaixa` do statusinvest */
export interface RootCashFlow {
  success: boolean
  data: {
    years: number[]
    grid: Grid[]
    chart: unknown[]
  }
}

/** Linha da grade do fluxo de caixa (a primeira linha traz os anos) */
interface Grid {
  isHeader: boolean
  row: number
  spaces: number
  columns: Column[]
  reverse: boolean
  emptyLine: boolean
  highlight: boolean
  article?: string
  gridLineModel?: GridLineModel
}

interface Column {
  value: string
  hide: boolean
  hasColor: boolean
  ignoreReverse: boolean
  timeType: number
  lastTwelveMonths: boolean
  name?: string
  title?: string
  symbol?: string
}

/** Valores de uma conta (ex.: lucro líquido), um por ano, na ordem das colunas */
interface GridLineModel {
  key?: string
  name: string
  values?: number[]
  ranks: unknown[]
  emptyLine: boolean
  spaces: number
  reverse: boolean
  format: string
  highlight: boolean
  article: string
  financialType?: number
}

/** Fluxo de caixa de um ano, com o valor de cada conta indexado pela chave */
export interface CashFlowYear {
  name: string
  index: number
  value: Record<string, number>
}
