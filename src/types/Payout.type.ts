// BRUTO

export interface RootPayout {
  actual: number
  avg: number
  avgDifference: number
  minValue: number
  minValueRank: number
  maxValue: number
  maxValueRank: number
  actual_F: string
  avg_F: string
  avgDifference_F: string
  minValue_F: string
  minValueRank_F: string
  maxValue_F: string
  maxValueRank_F: string
  chart: Chart
}

export interface Chart {
  categoryUnique: boolean
  category: string[]
  series: Series
}

export interface Series {
  percentual: Percentual[]
  proventos: Provento[]
  lucroLiquido: LucroLiquido[]
}

export interface Percentual {
  value: number
  value_F: string
}

export interface Provento {
  value: number
  value_F: string
  valueSmall_F: string
}

export interface LucroLiquido {
  value: number
  value_F: string
  valueSmall_F: string
}

// FORMATADO

export interface PayoutReturn {
  actual: number;
  average: number;
  minValue: number;
  maxValue: number;
  currency?: String;
  chart: Chart;
}
