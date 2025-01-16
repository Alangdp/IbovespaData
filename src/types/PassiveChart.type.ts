export interface PassiveChart {
  year: number
  ativoTotal: number
  passivoTotal: number
  ativoCirculante: number
  ativoNaoCirculante: number
  passivoCirculante: number
  passivoNaoCirculante: number
  patrimonioLiquido: number
}

export interface PassiveChartReturn {
  year: number
  totalAssets: number
  totalLiabilities: number
  currentAssets: number
  nonCurrentAssets: number
  currentLiabilities: number
  nonCurrentLiabilities: number
  shareholdersEquity: number
}
