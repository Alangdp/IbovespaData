import type { PontuationRule } from '../types/Pontuation.type.js'
import type { NetLiquid, StockProps } from '../types/stock.types.js'
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

/** Pontuação de uma ação pelos princípios de Benjamin Graham (listados acima) */
export class Graham {
  /**
   * @param stock - Ação avaliada
   * @param cdi - Taxa CDI anual em decimal (`null` se indisponível, e aí a
   * regra do CDI não pontua)
   */
  constructor(
    private readonly stock: StockProps,
    private readonly cdi: number | null,
  ) {}

  /**
   * Calcula a pontuação da ação
   *
   * @throws TypeError se a ação não tiver balanço patrimonial
   */
  makePoints(): Pontuation {
    const { stock } = this
    const { indicators, passiveChart } = stock

    // Carrega os indicadores atuais
    const p_l = Number(indicators.p_l.actual)
    const p_vp = Number(indicators.p_vp.actual)
    const roe = Number(indicators.roe.actual) / 100
    const { currentAssets, currentLiabilities } = passiveChart[0]
    const currentRatio = currentAssets / currentLiabilities

    // Calcula o valor intrínseco pela média histórica de LPA e VPA
    const lpa = indicators.lpa.olds.map((indicator) => Number(indicator.value))
    const vpa = indicators.vpa.olds.map((indicator) => Number(indicator.value))
    const intrinsicValue = Math.sqrt(
      22.5 * MathUtils.makeAverage(vpa) * MathUtils.makeAverage(lpa),
    )

    const netLiquidOn10Years = stock.netLiquid.slice(0, 10)

    // Carrega as regras do método
    const rules: PontuationRule[] = [
      {
        ruleName: 'Lucro líquido positivo nos últimos 10 anos',
        rule:
          netLiquidOn10Years.length === 10 &&
          netLiquidOn10Years.every((value) => value.value > 0),
      },
      {
        ruleName: '"Net Liquid" crescente nos últimos 10 anos',
        rule: isStrictlyGrowing(netLiquidOn10Years),
      },
      {
        ruleName: 'LPA crescente',
        rule: isLpaGrowing(lpa),
      },
      {
        ruleName: 'Pagamento constante de dividendos',
        rule: !stock.lastDividendsValue.some((dividend) => dividend.value <= 0),
      },
      {
        ruleName:
          'Fórmula de Benjamin Graham para Valor Intrínseco (Preço Justo)',
        rule: intrinsicValue > 1.5 * stock.actualPrice,
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
        ruleName: 'Crescimento do lucro líquido em 5 anos maior que 5%',
        rule: hasGrown(stock.netLiquid, 5),
      },
      {
        ruleName: 'ROE (Return On Equity) maior que 0.2',
        rule: roe > 0.2,
      },
      {
        ruleName: 'Dividend Yield atual maior que a taxa CDI',
        rule: this.cdi !== null && stock.actualDividendYield > this.cdi,
      },
      {
        ruleName: 'Índice de Liquidez Corrente maior que 1.5',
        rule: currentRatio > 1.5,
      },
      {
        ruleName: 'Dívida Bruta/Patrimônio inferior a 0.5',
        // Patrimônio negativo daria uma razão negativa e passaria na regra
        rule: stock.patrimony > 0 && stock.grossDebt / stock.patrimony < 0.5,
      },
    ]

    // Instancia a pontuação
    const pontuation = new Pontuation({
      infoData: {
        actualPrice: stock.actualPrice,
        dy: stock.actualDividendYield,
        maxPrice: intrinsicValue,
      },
      id: stock.ticker,
      subId: 'GRAHAM',
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

/**
 * Verifica se o lucro líquido cresceu todo ano
 *
 * @param netLiquid - Lucros do mais recente ao mais antigo
 */
function isStrictlyGrowing(netLiquid: NetLiquid[]): boolean {
  // Carrega os lucros em ordem cronológica
  const chronological = netLiquid.toReversed()

  return !chronological.some(
    (item, index) =>
      index > 0 && !(chronological[index - 1].value < item.value),
  )
}

/**
 * Verifica se a média do LPA dos 3 anos mais recentes supera em 33% a média
 * dos 3 anos mais antigos do período
 *
 * @param lpa - LPA do mais recente ao mais antigo
 */
function isLpaGrowing(lpa: number[]): boolean {
  const recent = MathUtils.makeAverage(lpa.slice(0, 3))
  const oldest = MathUtils.makeAverage(lpa.slice(-3))
  return recent > 1.33 * oldest
}

/**
 * Verifica se o lucro líquido cresceu mais de 5% em relação a `numberYears`
 * anos antes do mais recente
 */
function hasGrown(netLiquid: NetLiquid[], numberYears: number): boolean {
  const [latest] = netLiquid
  // Se não há lucro líquido
  if (!latest) {
    return false
  }

  // Busca o lucro líquido do ano de comparação
  const pastYear = String(Number(latest.year) - numberYears)
  const past = netLiquid.find((item) => item.year === pastYear)
  // Se não há dado para o ano de comparação
  if (!past) {
    return false
  }

  return (latest.value - past.value) / past.value > 0.05
}
