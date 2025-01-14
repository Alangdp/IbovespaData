import {
  BazinMethods,
  BazinProtocol,
} from '../interfaces/BazinProtocol.type.js'
import { PontuationRule } from '../types/Pontuation.type.js'
import { StockProps } from '../types/stock.types.js'
import MathUtils from '../utils/MathUtils.js'
import { Pontuation } from './Pontuation.js'

// TODO - REFAZER TUDO

export class Bazin extends BazinProtocol implements BazinMethods {
  constructor(stock: StockProps) {
    super()
    const {
      dividendYield,
      actualPrice,
      lastDividendsYieldYear,
      lastDividendsValueYear,
      segment,
    } = stock
    this.segment = segment
    this.lastDividendsValue = lastDividendsValueYear.splice(0, 5)
    this.lastDividendsYield = lastDividendsYieldYear.splice(0, 5)
    this.lastDividendYieldBrute = lastDividendsYieldYear.splice(0, 5)
    this.lastDividendYieldBrute.shift()

    this.dividendYieldAverage = MathUtils.makeAverage(this.lastDividendsYield)
    this.dividendYieldMedian = MathUtils.makeMedian(this.lastDividendsYield)

    this.actualDividends = actualPrice * dividendYield
    this.actualPrice = actualPrice
    this.maxPrice = MathUtils.makeAverage(this.lastDividendsValue) / 0.06
    this.validate(stock)
  }

  validate(stock: StockProps) {
    const { grossDebt, patrimony } = stock

    if (grossDebt === null || grossDebt === undefined)
      throw new Error('Invalid gross debt')
    if (patrimony === null || patrimony === undefined)
      throw new Error('Invalid patrimony')
  }

  public constistentDividend() {
    const { lastDividendsYield } = this
    let consistent = true
    for (const dividend of lastDividendsYield) {
      if (dividend < 0.06) consistent = false
    }
    return consistent
  }

  // FIXME LOOP ESTA AO CONTRARIO
  public crescentDividend() {
    const { lastDividendYieldBrute } = this
    const tolerance = 1

    let previousDividend = Math.abs(lastDividendYieldBrute[0])
    for (let i = 1; i < lastDividendYieldBrute.length; i++) {
      if (Math.abs(lastDividendYieldBrute[i]) < previousDividend - tolerance) {
        return false
      }
      previousDividend = Math.abs(lastDividendYieldBrute[i])
    }
    return true
  }

  public makePoints(stock: StockProps) {
    const { dividendYieldMedian } = this
    const {
      grossDebt,
      patrimony,
      actualDividendYield,
      payout,
      actualPrice,
      ticker,
    } = stock
    const segment = this.segment
    const permitedSegments = [
      'Bancos',
      'Energia Elétrica',
      'Água e Saneamento',
      'Telecomunicações',
      'Seguradoras',
    ]

    const rules: PontuationRule[] = [
      {
        ifFalse: 1,
        ifTrue: 2,
        rule: this.dividendYieldAverage >= 0.06,
        ruleName: 'Média do Dividend Yield nos últimos 5 anos > 0.06 (5%)',
      },
      {
        ifFalse: 1,
        ifTrue: 2,
        rule: dividendYieldMedian >= 0.06,
        ruleName: 'Mediana do Dividend Yield nos últimos 5 anos > 0.06 (5%)',
      },
      {
        ifFalse: 1,
        ifTrue: 2,
        rule: actualDividendYield >= 0.06,
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
        rule: actualPrice < this.maxPrice!,
        ruleName: 'Preço Atual < Preço Máximo',
      },
      {
        ifFalse: 4,
        ifTrue: 0,
        rule: permitedSegments.includes(segment),
        ruleName: 'Segmento válido',
      },
    ]

    const pontuation = new Pontuation({
      infoData: {
        actualPrice: this.actualPrice,
        dy: this.lastDividendsYield[1],
        maxPrice: this.maxPrice!,
      },
      id: ticker,
      subId: 'BAZIN',
      defaultIfFalse: 1,
      defaultIfTrue: 1,
      totalPoints: 0,
      totalEvaluate: [],
    })

    rules.forEach((rule) => {
      pontuation.addRule(rule)
    })

    pontuation.calculate()

    return pontuation
  }
}
