export interface Column {
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

export interface GridLineModel {
  key: string
  name: string
  values: Array<number | null>
  ranks: unknown[]
  emptyLine: boolean
  spaces: number
  reverse: boolean
  format: string
  highlight: boolean
  article?: string
  suffix?: string
  financialType?: number
}

export interface Grid {
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

export interface DReData {
  years: number[]
  grid: Grid[]
  chart: unknown[]
}

export interface DReRoot {
  success: boolean
  data: DReData
}

export type ValuesData = {
  [date: string]: {
    date: string
    value: number | null
  }
}

export type DreData = {
  [ticker: string]: {
    actual: number | null
    values: ValuesData
  }
}
