import type { PontuationRule } from '../types/Pontuation.type.js'
import type { StockProps } from '../types/stock.types.js'
import MathUtils from '../utils/MathUtils.js'
import { Pontuation } from './Pontuation.js'

/** Segmentos considerados perenes pelo método Bazin */
const PERMITTED_SEGMENTS = [
  'Bancos',
  'Energia Elétrica',
  'Água e Saneamento',
  'Telecomunicações',
  'Seguradoras',
]

/** Dividend yield mínimo exigido pelo método (6%) */
const MIN_DIVIDEND_YIELD = 0.06

/** Queda máxima de dividend yield aceita de um ano para o seguinte (1 p.p.) */
const DIVIDEND_YIELD_TOLERANCE = 0.01

/** Pontuação de uma ação pelo método de Décio Bazin (foco em dividendos) */
export class Bazin {
  private readonly lastDividendsValue: number[]
  /** Dividend yield dos últimos 5 anos, em decimal, do mais recente ao mais antigo */
  private readonly lastDividendsYield: number[]
  private readonly dividendYieldAverage: number
  private readonly dividendYieldMedian: number
  private readonly maxPrice: number

  /**
   * @param stock - Ação avaliada
   * @throws Error se a dívida bruta ou o patrimônio não estiverem preenchidos
   */
  constructor(private readonly stock: StockProps) {
    // Valida os campos usados na relação dívida/patrimônio
    if (stock.grossDebt === null || stock.grossDebt === undefined) {
      throw new Error('Invalid gross debt')
    }
    if (stock.patrimony === null || stock.patrimony === undefined) {
      throw new Error('Invalid patrimony')
    }

    // Carrega os últimos 5 anos de dividendos e de dividend yield (a fonte
    // traz o yield em percentual)
    this.lastDividendsValue = stock.lastDividendsValueYear.slice(0, 5)
    this.lastDividendsYield = stock.lastDividendsYieldYear
      .slice(0, 5)
      .map((value) => value / 100)

    // Calcula média e mediana do dividend yield
    this.dividendYieldAverage = MathUtils.makeAverage(this.lastDividendsYield)
    this.dividendYieldMedian = MathUtils.makeMedian(this.lastDividendsYield)

    // Calcula o preço máximo (dividendo médio / yield mínimo)
    this.maxPrice =
      MathUtils.makeAverage(this.lastDividendsValue) / MIN_DIVIDEND_YIELD
  }

  /** Verifica se o dividend yield ficou acima do mínimo em todos os anos */
  public constistentDividend(): boolean {
    return !this.lastDividendsYield.some(
      (dividend) => dividend < MIN_DIVIDEND_YIELD,
    )
  }

  /**
   * Verifica se o dividend yield não caiu mais que 1 p.p. de um ano para o
   * seguinte nos últimos 5 anos
   */
  public crescentDividend(): boolean {
    // Carrega os yields em ordem cronológica
    const yields = this.lastDividendsYield.toReversed()

    return !yields.some(
      (value, index) =>
        index > 0 && value < yields[index - 1] - DIVIDEND_YIELD_TOLERANCE,
    )
  }

  /** Calcula a pontuação da ação */
  public makePoints(): Pontuation {
    const { grossDebt, patrimony, actualDividendYield, payout, actualPrice } =
      this.stock

    // Carrega as regras do método
    const rules: PontuationRule[] = [
      {
        ifFalse: 1,
        ifTrue: 2,
        rule: this.dividendYieldAverage >= MIN_DIVIDEND_YIELD,
        ruleName: 'Média do Dividend Yield nos últimos 5 anos > 0.06 (6%)',
      },
      {
        ifFalse: 1,
        ifTrue: 2,
        rule: this.dividendYieldMedian >= MIN_DIVIDEND_YIELD,
        ruleName: 'Mediana do Dividend Yield nos últimos 5 anos > 0.06 (6%)',
      },
      {
        ifFalse: 1,
        ifTrue: 2,
        rule: actualDividendYield >= MIN_DIVIDEND_YIELD,
        ruleName: 'Dividend Yield Atual > 0.06 (6%)',
      },
      {
        ifFalse: 1,
        ifTrue: 2,
        rule: grossDebt / patrimony <= 0.5,
        ruleName: 'Dívida Bruta/Patrimônio < 0.5 (50%)',
      },
      {
        ifFalse: 1,
        ifTrue: 1,
        rule: this.constistentDividend(),
        ruleName: 'Pagamento constante de dividendos nos últimos 5 anos',
      },
      {
        ifFalse: 1,
        ifTrue: 1,
        rule: this.crescentDividend(),
        ruleName: 'Dividendos crescentes nos últimos 5 anos',
      },
      {
        ifFalse: 1,
        ifTrue: 1,
        rule: payout > 0 && payout < 1,
        ruleName: '0 < Payout < 1',
      },
      {
        ifFalse: 1,
        ifTrue: 1,
        rule: actualPrice < this.maxPrice,
        ruleName: 'Preço Atual < Preço Máximo',
      },
      {
        ifFalse: 4,
        ifTrue: 0,
        rule: PERMITTED_SEGMENTS.includes(this.stock.segment),
        ruleName: 'Segmento válido',
      },
    ]

    // Instancia a pontuação
    const pontuation = new Pontuation({
      infoData: {
        actualPrice,
        dy: actualDividendYield,
        maxPrice: this.maxPrice,
      },
      id: this.stock.ticker,
      subId: 'BAZIN',
      defaultIfFalse: 1,
      defaultIfTrue: 1,
    })

    // Calcula os pontos
    for (const rule of rules) {
      pontuation.addRule(rule)
    }
    pontuation.calculate()

    return pontuation
  }
}
