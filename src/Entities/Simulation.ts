// Simular Investimento ao longo do tempo
// Problematização: Como simular um investimento ao longo do tempo?
// Limitações:
// - Não considera inflação
// - Não considera impostos
// - Não considera aportes
// - Dados de entrada dos ultimos 5 anos (Tempo máximo de simulação)

// Deve conter:
// [ ] Método para simular investimento ao longo do tempo
// [ ] Método para calcular o valor futuro do investimento - Reconsiderar
// [ ] Método para calcular o valor presente do investimento
// [ ] Método para calcular o rendimento do investimento
// [ ] Método para calcular o rendimento do investimento com reinvestimento de dividendos
// [ ] Método para calcular o rendimento do investimento com reinvestimento de dividendos e aportes mensais
// [ ] Comparar com a inflação
// [ ] Comparar com a poupança
// [ ] Comparar com o CDI
// [ ] Comparar com o IBOVESPA
// [ ] Comparar com o S&P500
// [ ] Calcular a perda ou lucro - GainOrLoss

import { fetchPrices } from '../sources/statusinvest'
import type { PriceReturn } from '../types/prices.type'
import { DateFormatter } from '../utils/DateFormater'

/** Situação do investimento em um dia do histórico */
type SimulationHistory = {
  date: Date | null
  price: number
  /** Ganho ou perda por papel desde o início */
  gainOrLossIndividual: number
  /** Ganho ou perda de todos os papéis desde o início */
  gainOrLossGeneral: number
  gainOrLossCDI: number
  totalCapital: number
}

/** Resultado da simulação */
type SimulationType = {
  startSimulation: Date | null
  endSimulation: Date | null
  /** Variação do preço de um papel entre o primeiro e o último dia */
  gainOrLoss: number
  history: SimulationHistory[]
}

/** Simula a compra da ação no início do histórico e a evolução até hoje */
export class Simulation {
  /** Histórico de preços (últimos 5 anos), carregado por `initialize` */
  public priceHistory: PriceReturn | null = null

  /**
   * @param ticker - Código da ação (ex.: PETR4)
   * @param startInvestValue - Valor investido no primeiro dia (R$)
   */
  constructor(
    private readonly ticker: string,
    private readonly startInvestValue: number,
  ) {}

  /**
   * Carrega o histórico de preços da ação
   *
   * @throws Error se o ticker for inválido ou o histórico não vier
   */
  async initialize() {
    this.priceHistory = await fetchPrices(this.ticker)
    // Se o histórico não foi carregado
    if (!this.priceHistory) {
      throw new Error(`Invalid Ticker: ${this.ticker}`)
    }
  }

  /**
   * Executa a simulação sobre o histórico carregado
   *
   * @throws Error se `initialize` não carregou o histórico
   */
  execute(): SimulationType {
    const prices = this.priceHistory?.priceVariation
    // Se o histórico não foi carregado
    if (!prices) {
      throw new Error('Error getting price')
    }

    const startPrice = prices[0].price
    const endPrice = prices[prices.length - 1].price
    const startDate = DateFormatter.stringToDate(prices[0].date)
    const endDate = DateFormatter.stringToDate(prices[prices.length - 1].date)

    // Calcula quantos papéis o valor inicial compra (no mínimo 1)
    const stocksQuantity = (this.startInvestValue / startPrice) | 0 || 1

    return {
      startSimulation: startDate,
      endSimulation: endDate,
      gainOrLoss: endPrice - startPrice,
      // Calcula a situação do investimento em cada dia
      history: prices.map(
        ({ date, price }): SimulationHistory => ({
          date: DateFormatter.stringToDate(date),
          price,
          gainOrLossIndividual: price - startPrice,
          gainOrLossGeneral: (price - startPrice) * stocksQuantity,
          gainOrLossCDI: 0,
          totalCapital: price * stocksQuantity,
        }),
      ),
    }
  }
}
