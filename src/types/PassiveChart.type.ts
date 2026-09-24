/** Item da resposta de `getbsactivepassivechart` do statusinvest */
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

/** Balanço patrimonial de um ano */
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
