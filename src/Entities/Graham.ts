import { MacroInfo } from '../global/MacroInfo.js'
import {
  GranhamMethods,
  GranhamProtocol,
} from '../interfaces/GranhamProtocol.type.js'
import { StockProtocol } from '../interfaces/StockProtocol.type.js'
import { oldIndicator } from '../types/indicators.type.js'
import { PontuationRule } from '../types/Pontuation.type.js'
import { NetLiquid } from '../types/stock.types.js'
import MathUtils from '../utils/MathUtils.js'
import { Pontuation } from './Pontuation.js'

// Princípios utilizados:

// - [x] 1.  Sobrevivência: Sobreviveu nos últimos 10 anos.
// - [x] 2.  Estabilidade ds Lucros: Lucro > 0 nos últimos 10 anos. https://www.estrategista.net/o-fracasso-de-benjamin-graham-na-bolsa-atual/
// - [x] 3.  Crescimento dos Lucros: Lucros crescentes nos últimos 10 anos https://www.estrategista.net/o-fracasso-de-benjamin-graham-na-bolsa-atual/
// - [x] 4.  Crescimento dos Lucro Por Ação: LPA atual > 1.33 * LPA 10 anos atrás. (Calculado através da média dos 3 anos do começo e dos 3 anos do fim deste período) http://seuguiadeinvestimentos.com.br/a-tecnica-de-investimento-de-benjamin-graham-ii/
// - [x] 5.  Estabilidade dos Dividendos: Dividendos pagos nos últimos 10 anos. http://seuguiadeinvestimentos.com.br/a-tecnica-de-investimento-de-benjamin-graham-ii/
// - [x] 6.  raíz_quadrada_de(22.5 * VPA * LPA) => Quanto maior, melhor. Ideal > 1.5 * Preço. https://www.sunoresearch.com.br/artigos/valor-intrinseco/?utm_source=PR&utm_medium=artigo&utm_campaign=investing_05122019
// - [x] 7.  P/L (Preço/Lucro) => Quanto menor, melhor (ideal, < 15 E >= 0) http://seuguiadeinvestimentos.com.br/a-tecnica-de-investimento-de-benjamin-graham-ii/
// - [x] 8.  P/VP (Preço/Valor Patrimonial) => Quanto menor, melhor (ideal, < 1.5 E >= 0) http://seuguiadeinvestimentos.com.br/a-tecnica-de-investimento-de-benjamin-graham-ii/
// - [x] 9.  Crescimento em 5 anos => Quanto maior, melhor (ideal, > 5%) https://daxinvestimentos.com/analise-fundamentalista-mais-de-200-de-rentabilidade-em-2-anos/
// - [x] 10. ROE (Return On Equity) => Quanto maior, melhor (ideal, superior a 20%) https://daxinvestimentos.com/analise-fundamentalista-mais-de-200-de-rentabilidade-em-2-anos/
// - [x] 11. Dividend Yield (Rendimento de Dividendo) => Quanto maior, melhor (ideal, > Taxa Selic (4.5%)) https://foconomilhao.com/acoes-com-dividend-yield-maior-que-a-selic/
// - [x] 12. Liquidez Corrente => Quanto maior, melhor (ideal > 1.5) https://daxinvestimentos.com/analise-fundamentalista-mais-de-200-de-rentabilidade-em-2-anos/
// - [x] 13. Dívida Bruta/Patrimônio => Quanto menor, melhor (ideal < 50%) https://daxinvestimentos.com/analise-fundamentalista-mais-de-200-de-rentabilidade-em-2-anos/
// - [] 14. Patrimônio Líquido => Quanto maior, melhor (ideal > 2000000000)

// ### Graham ###
// ===== Próximos =====
// * Valor de Mercado maior que 2.000.000 . // Benjamin Graham // https://edisciplinas.usp.br/pluginfile.php/3821144/mod_resource/content/4/245.pdf
//   => https://www.fundamentus.com.br/detalhes.php?papel=PETR4
// * Valor médio de negociações superior a R$ 1 milhão. // Benjamin Graham // https://daxinvestimentos.com/analise-fundamentalista-mais-de-200-de-rentabilidade-em-2-anos/
//   ~> Vol $ méd (2m) > 1.000.000
//   => https://www.fundamentus.com.br/detalhes.php?papel=PETR4
// * Endividamento de longo prazo < Capital de Giro // Benjamin Graham // https://www.sunoresearch.com.br/artigos/o-investidor-inteligente-entenda-a-obra-de-benjamin-graham/
// * Possui bom nível de governança corporativa // Benjamin Graham // https://daxinvestimentos.com/analise-fundamentalista-mais-de-200-de-rentabilidade-em-2-anos/

// Lucros para fazer o Gráfico ;)
// https://api-analitica.sunoresearch.com.br/api/Statement/GetStatementResultsReportByTicker?type=y&ticker=WEGE3&period=10

// TODO - REFAZER TUDO

// @ts-ignore
export class Granham extends GranhamProtocol implements GranhamMethods {
  constructor(stock: StockProtocol) {
    super()
    const { indicators, passiveChart } = stock
    const { currentLiabilities, currentAssets } = passiveChart[0]

    this.p_l = Number(indicators.p_l.actual)
    this.p_vp = Number(indicators.p_vp.actual)
    this.roe = Number(indicators.roe.actual) / 100

    indicators.lpa.olds.map((indicator: oldIndicator) => {
      this.lpa.push(Number(indicator.value))
    })

    indicators.vpa.olds.map((indicator: oldIndicator) => {
      this.vpa.push(Number(indicator.value))
    })

    this.netLiquid = stock.netLiquid
    this.currentRatio = currentAssets / currentLiabilities

    this.grossDebt = stock.grossDebt
    this.patrimony = stock.patrimony
    if (this.patrimony === 0) this.patrimony = 1
    if (this.grossDebt === 0) this.grossDebt = 1

    this.gb_p = this.grossDebt / this.patrimony
    this.actualPrice = stock.actualPrice
    this.ticker = stock.ticker
    this.dy = stock.actualDividendYield
  }

  async makePoints(stock: StockProtocol) {
    const { netLiquid, vpa, lpa, p_l, p_vp, roe } = this

    const lpaAverage = MathUtils.makeAverage(lpa)
    const vpaAverage = MathUtils.makeAverage(vpa)
    const netLiquidOn10Years = netLiquid.slice(0, 10)
    const rules: PontuationRule[] = [
      {
        ruleName: 'A empresa tem dados de "Net Liquid" para os últimos 10 anos',
        rule: netLiquidOn10Years.every((value) => value.value > 0),
      },
      {
        ruleName: '"Net Liquid" crescente nos últimos 10 anos',
        rule: this.crescentNetLiquid(netLiquidOn10Years),
      },
      {
        ruleName: 'LPA crescente',
        rule: this.crescentLpa(),
      },
      {
        ruleName: 'Pagamento constante de dividendos',
        rule: this.constantDividend(stock),
      },
      {
        ruleName:
          'Fórmula de Benjamin Graham para Valor Intrínseco (Preço Justo)',
        rule:
          Math.sqrt(22.5 * vpaAverage * lpaAverage) > 1.5 * stock.actualPrice,
      },
      {
        ruleName: 'P/L (Preço/Lucro) entre 0 e 15',
        rule: p_l > 0 && p_l < 15,
      },
      {
        ruleName: 'P/VP (Preço/Valor Patrimonial) entre 0 e 1.5',
        rule: p_vp > 0 && p_vp < 1.5,
      },
      {
        ruleName: 'Crescimento médio em 5 anos é positivo',
        rule: this.calculateYearGrowth(stock, 5),
      },
      {
        ruleName: 'ROE (Return On Equity) maior que 0.2',
        rule: roe > 0.2,
      },
      {
        ruleName: 'Dividend Yield atual maior que a taxa CDI',
        rule: stock.actualDividendYield > MacroInfo.CDI,
      },
      {
        ruleName: 'Índice de Liquidez Corrente maior que 1.5',
        rule: this.currentRatio > 1.5,
      },
      {
        ruleName: 'Dívida Bruta/Patrimônio inferior a 0.5',
        rule: this.patrimony > 2000000000,
      },
    ]

    const pontuation = new Pontuation({
      infoData: {
        actualPrice: this.actualPrice,
        dy: this.dy,
        maxPrice: Math.sqrt(22.5 * vpaAverage * lpaAverage),
      },
      id: this.ticker,
      subId: 'GRAHAM',
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

  crescentNetLiquid(netLiquidOn10Years: NetLiquid[]): boolean {
    let crescent = true
    for (let i = 0; i < netLiquidOn10Years.length; i++) {
      if (netLiquidOn10Years[i + 1] === undefined) break
      if (!(netLiquidOn10Years[i].value < netLiquidOn10Years[i + 1].value))
        crescent = false
    }
    return crescent
  }

  crescentLpa(): boolean {
    const { lpa } = this

    const lpaInitial = (lpa[0] + lpa[1] + lpa[2]) / 3
    const lpaFinal =
      (lpa[lpa.length - 3] + lpa[lpa.length - 2] + lpa[lpa.length - 1]) / 3

    const crescent = lpa[lpa.length - 1] > 1.33 * lpaInitial

    return crescent
  }

  constantDividend(stock: StockProtocol): boolean {
    const { lastDividendsValue } = stock
    let crescent = true

    lastDividendsValue.map((dividend) => {
      if (dividend.value <= 0) crescent = false
    })

    return crescent
  }

  calculateYearGrowth(stock: StockProtocol, numberYears: number): boolean {
    try {
      const { netLiquid } = stock

      const actualYear = netLiquid[0].year
      const lastYear = (Number(actualYear) - numberYears).toString()

      const actualNetLiquid = netLiquid.find(
        (netLiquid) => netLiquid.year === actualYear,
      )
      const lastNetLiquid = netLiquid.find(
        (netLiquid) => netLiquid.year === lastYear,
      )

      if (!actualNetLiquid || !lastNetLiquid)
        throw new Error('Invalid NetLiquid')

      const growth =
        (actualNetLiquid.value - lastNetLiquid.value) / lastNetLiquid.value

      if (growth > 0.05) return true
      return false
    } catch (error) {
      console.error(error)
      return false
    }
  }
}
