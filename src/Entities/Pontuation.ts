import type {
  InfoData,
  PontuationProps,
  PontuationRule,
} from '../types/Pontuation.type'

/** Pontuação de uma ação segundo um método (Bazin, Graham...) */
export class Pontuation implements PontuationProps {
  /** Ticker avaliado */
  id: string
  /** Método de avaliação (BAZIN, GRAHAM) */
  subId?: string
  /** Pontos somados por regra verdadeira sem `ifTrue` */
  defaultIfTrue: number
  /** Pontos subtraídos por regra falsa sem `ifFalse` */
  defaultIfFalse: number
  totalPoints = 0
  totalEvaluate: PontuationRule[] = []
  infoData: InfoData

  constructor(props: PontuationProps) {
    this.id = props.id
    this.subId = props.subId
    this.defaultIfTrue = props.defaultIfTrue
    this.defaultIfFalse = props.defaultIfFalse
    this.infoData = props.infoData
  }

  /** Adiciona uma regra à avaliação */
  addRule(rule: PontuationRule) {
    this.totalEvaluate.push(rule)
  }

  /**
   * Calcula o total de pontos e marca cada regra como pontuada ou não
   *
   * Regras sem `ifTrue`/`ifFalse` usam os padrões; 0 vale como 0 pontos
   */
  calculate() {
    for (const rule of this.totalEvaluate) {
      // Se a regra foi atendida
      if (rule.rule) {
        this.totalPoints += rule.ifTrue ?? this.defaultIfTrue
      } else {
        this.totalPoints -= rule.ifFalse ?? this.defaultIfFalse
      }
      rule.scored = rule.rule
    }
  }
}
