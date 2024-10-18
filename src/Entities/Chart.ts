import { ChartProtocol } from '../interfaces/ChartProtocol.type';
import {
  ChartConstructor,
  Chart as ChartModel,
  ChartPortifolio,
  StockData,
  StockRentability,
} from '../types/Chart.type';
import { DividendOnDate } from '../types/dividends.type';
import { StockPrice } from '../types/stock.types';
import { TransactionsProps } from '../types/transaction.type';

export default class Chart implements ChartProtocol {
  public globalRentability!: number;
  public globalStockQuantity!: number;
  public globalStockValue!: number;
  public globalDividendValue!: number;
  public globalTotalValue!: number;
  public globalInvested!: number;
  public individualRentability!: StockRentability;
  public portifolio!: ChartPortifolio;

  constructor(requirements: ChartConstructor | null) {
    if (!requirements) {
      this.makeEmptyChart();
      return;
    }

    this.globalRentability = requirements.globalRentability;
    this.globalStockQuantity = requirements.globalStockQuantity;
    this.globalStockValue = requirements.globalStockValue;
    this.globalDividendValue = requirements.globalDividendValue;
    this.globalTotalValue = requirements.globalTotalValue;
    this.individualRentability = requirements.individualRentability;
    this.portifolio = requirements.portifolio
  }

  makeEmptyChart() {
    this.globalRentability = 0;
    this.globalStockQuantity = 0;
    this.globalStockValue = 0;
    this.globalDividendValue = 0;
    this.globalTotalValue = 0;
    this.individualRentability = {};
  }

  createTickerOnChart(ticker: string): StockData {
    this.individualRentability[ticker] = {
      medianPrice: 0,
      rentability: 0,
      quantity: 0,
      valueTotal: 0,
      valueInvested: 0,
      dividendPayments: [],
      dividendValue: 0,
    };

    return this.individualRentability[ticker];
  }

  buyUpdate(
    individualChart: StockData,
    ticker: string,
    quantity: number,
    valueInvested: number
  ) {
    individualChart.quantity += quantity;
    individualChart.valueInvested += valueInvested;

    individualChart.medianPrice =
      individualChart.valueInvested / individualChart.quantity;
    this.individualRentability[ticker] = individualChart;
  }

  sellUpdate(
    individualChart: StockData,
    ticker: string,
    quantity: number,
    valueInvested: number
  ) {
    const lastQuantity = individualChart.quantity;
    if (lastQuantity - quantity <= 0) {
      delete this.individualRentability[ticker];
      return;
    }

    individualChart.valueInvested -= valueInvested;
    individualChart.quantity = lastQuantity - quantity;

    this.individualRentability[ticker] = individualChart;
  }

  updateGlobals(prices: StockPrice) {
    let globalStockQuantity = 0;
    let globalStockValue = 0;
    let globalDividendValue = 0;
    let globalTotalValue = 0;
    let globalInvested = 0;

    for (const ticker in this.individualRentability) {
      try {
        const stockData = this.individualRentability[ticker];
        const { quantity, valueInvested, dividendValue } = stockData;

        globalStockQuantity += quantity;
        globalStockValue += valueInvested;
        globalDividendValue += dividendValue;
        globalTotalValue += prices[ticker].price * quantity + dividendValue;
        globalInvested += valueInvested;
      } catch (error) {
        continue
      }
    }

    this.globalStockQuantity = globalStockQuantity;
    this.globalStockValue = globalStockValue;
    this.globalDividendValue = globalDividendValue;
    this.globalTotalValue = globalTotalValue;
    this.globalInvested = globalInvested;
  }

  updateTickers(pricesOnDate: StockPrice, date: string) {
    for (const ticker in this.individualRentability) {
      try {
        const individualChart = this.individualRentability[ticker];
        const stockData = this.individualRentability[ticker];
        const { medianPrice } = individualChart;
        const actualPrice = pricesOnDate[ticker].price;
        const { quantity } = stockData;

        stockData.valueTotal = quantity * actualPrice;
        stockData.rentability = (actualPrice - medianPrice) / medianPrice;
        this.individualRentability[ticker] = stockData;
      } catch (error: any) {
        continue;
      }
    }
  }

  updateDividends(dividends: DividendOnDate, date: string) {
    for (const ticker of Object.keys(dividends)) {
      const individualChart = this.individualRentability[ticker];
      if (individualChart === undefined) continue;
      const dividend = dividends[ticker];

      const dividendValue = individualChart.quantity * dividend.value;
      this.globalDividendValue += dividendValue;

      individualChart.dividendValue += dividendValue;
      individualChart.dividendPayments.push({
        date,
        value: dividendValue,
        unitaryValue: dividend.value
      });

      this.individualRentability[ticker] = individualChart;
    }
  }

  updateChart(
    transactions: TransactionsProps[],
    prices: StockPrice,
    dividends: DividendOnDate,
    date: string
  ): ChartConstructor {
    const transactionsLength = transactions.length;
    if (transactionsLength > 0) {
      for (const transaction of transactions) {
        const ticker = transaction.ticker;
        const quantity = transaction.quantity;
        const price = transaction.price;
        const valueInvested = quantity * price;
        let individualChart: StockData = this.individualRentability[ticker];

        if (!individualChart)
          individualChart = this.createTickerOnChart(ticker);

        if (transaction.type === 'BUY') {
          this.buyUpdate(individualChart, ticker, quantity, valueInvested);
        }

        if (transaction.type === 'SELL') {
          this.sellUpdate(individualChart, ticker, quantity, valueInvested);
        }
      }
    }

    this.updateTickers(prices, date);
    this.updateGlobals(prices);
    this.updateDividends(dividends, date);
    this.makePortfolioChart();

    const dataToReturn: ChartConstructor = {
      globalRentability: this.globalRentability,
      globalStockQuantity: this.globalStockQuantity,
      globalStockValue: this.globalStockValue,
      globalDividendValue: this.globalDividendValue,
      globalTotalValue: this.globalTotalValue,
      globalInvested: this.globalInvested,
      individualRentability: this.individualRentability,
      portifolio: this.portifolio
    }
    return dataToReturn
  }

  makePortfolioChart(): ChartPortifolio {
    let totalWeight = 0;
    let totalValue = 0;

    const portfolioChart: ChartPortifolio = {};

    for (const ticker of Object.keys(this.individualRentability)) {
        const individualChart = this.individualRentability[ticker];

        const weight = this.globalTotalValue / individualChart.valueTotal;
        const value = weight * individualChart.rentability;

        portfolioChart[ticker] = weight;

        totalWeight += weight;
        totalValue += value;
    }

    // Correção do cálculo da rentabilidade global
    this.globalRentability = totalWeight > 0 ? totalValue / totalWeight : 0;

    // Normalização dos pesos para somar 1
    for (const ticker of Object.keys(portfolioChart)) {
        portfolioChart[ticker] /= totalWeight;
    }

    this.portifolio = portfolioChart;
    return portfolioChart;
  }

  returnChart(): ChartModel {
    return {
      globalRentability: this.globalRentability,
      globalStockQuantity: this.globalStockQuantity,
      globalStockValue: this.globalStockValue,
      globalDividendValue: this.globalDividendValue,
      globalTotalValue: this.globalTotalValue,
      individualRentability: this.individualRentability,
    };
  }
}
