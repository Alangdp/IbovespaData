/** Regra de pontuação e quantos pontos ela soma (verdadeira) ou subtrai (falsa) */
export interface PontuationRule {
  ruleName: string
  rule: boolean
  ifTrue?: number
  ifFalse?: number
  scored?: boolean
}

/** Dados de apoio exibidos junto com a pontuação */
export interface InfoData {
  actualPrice: number
  maxPrice: number
  dy: number
}

/** Dados para criar uma `Pontuation` */
export interface PontuationProps {
  defaultIfTrue: number
  defaultIfFalse: number
  id: string
  subId?: string
  infoData: InfoData
}
