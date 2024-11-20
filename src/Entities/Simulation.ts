// Simular Investimento ao longo do tempo
// Problematização: Como simular um investimento ao longo do tempo?
// Limitações:
// - Não considera inflação
// - Não considera impostos
// - Não considera aportes
// - Dados de entrada dos ultimos 5 anos (Tempo máximo de simulação)

import { PriceReturn } from '../types/prices.type';
import TickerFetcher from '../useCases/Fetcher';
import { DateFormatter } from '../utils/DateFormater';

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

// Renomear o tipo
type PriceHistory = PriceReturn | null;

type SimulationHistory = {
  date: Date;
  price: number;
  gainOrLossIndividual: number;
  gainOrLossGeneral: number;
  gainOrLossCDI: number;

  totalCapital: number;
};

type SimulationType = {
  startSimulation: Date;
  endSimulation: Date;
  gainOrLoss: number;
  history: SimulationHistory[];
};

export class Simulation {
  private ticker: string;
  private fetcher: TickerFetcher;
  public priceHistory: PriceHistory = null; // Últimos 5 anos
  private startInvestValue = 0;

  constructor(ticker: string, startInvestValue: number) {
    this.ticker = ticker;
    this.fetcher = new TickerFetcher(ticker);
    this.startInvestValue = startInvestValue;
  }

  async initialize() {
    try {
      const prices = await this.fetcher.getPrice();
      if (!prices) throw new Error('Error getting price history');
      this.priceHistory = prices;
    } catch (error) {
      throw new Error(`Invalid Ticker: ${this.ticker}`);
    }
  }

  async execute(): Promise<SimulationType> {
    const priceVariation = this.priceHistory?.priceVariation;
    if (!priceVariation) throw new Error('Error getting price');

    const pricesLength = priceVariation.length || 0;

    // Datas inicio e fim
    const startDate = DateFormatter.stringToDate(priceVariation[0].date)!;
    const endDate = DateFormatter.stringToDate(
      priceVariation[pricesLength - 1].date
    )!;

    // Preços
    const startPrice = priceVariation[0].price;
    // Número de pápeis
    let stocksQuantity = 0;
    // Calculo número de pápeis iniciais
    stocksQuantity = (this.startInvestValue / startPrice) | 0;
    stocksQuantity = stocksQuantity === 0 ? 1 : stocksQuantity;

    const simulation: SimulationType = {
      endSimulation: endDate,
      startSimulation: endDate,
      gainOrLoss: priceVariation[pricesLength - 1].price - startPrice,
      history: [],
    };

    for (let i = 0; i < pricesLength; i++) {
      const price = priceVariation[i];

      const history: SimulationHistory = {
        date: DateFormatter.stringToDate(priceVariation[i].date)!,

        price: priceVariation[i].price,

        gainOrLossIndividual: priceVariation[i].price - startPrice,
        gainOrLossGeneral:
          (priceVariation[i].price - startPrice) * stocksQuantity,

        gainOrLossCDI: 0,
        totalCapital: priceVariation[i].price * stocksQuantity,
      };

      simulation.history.push(history);
    }
    return simulation;
  }
}
