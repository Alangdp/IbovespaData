import { HistoryData, HistoryRequirements } from '../types/History.type.js';
import { IndexDividend, IndexHistoryPrice } from '../types/Index.type.js';
import { Dividend, DividendOnDate } from '../types/dividends.type.js';
import { StockInfo, StockPrice, StockProps } from '../types/stock.types.js';

import HistoryUtils from '../utils/History.Utils.js';
import Utilities from '../utils/Utilities.js';

import Json from '../utils/Json.js';
import Chart from './Chart.js';

import { ChartProtocol } from './../interfaces/ChartProtocol.type';
import BuyTransaction from './BuyTransaction.js';
import { StockDataBase } from '../useCases/stockDataBase.js';
import { DateFormatter } from '../utils/DateFormater.js';
import { TransactionHistory } from '../interfaces/Transaction.js';
import { TransactionsProps } from '../types/transaction.type.js';


// FIXME ARRUMAR SOLID AQUI

// METAS:
// 1 - IMPLEMENTAR DIVIDENDOS - COMPLETO - COMPLETO
// 2 - ATUALIZAR DADOS SECUNDARIOS DO CHART - COMPLETO
// globalRentabily: number;
// globalStockQuantity: number;
// globalStockValue: number;
// globalDividendValue: number;
// globalTotalValue: number;

// TODO: SISTEMA DE THREADS(OTIMIZAÇÃO) - https://stackoverflow.com/questions/25167590/one-thread-for-many-tasks-vs-many-threads-for-each-task-do-sleeping-threads-aft

export class History {
  stockInfo: StockInfo;
  transactions: TransactionsProps[]
  historyData: HistoryData;
  chart: ChartProtocol = new Chart(null);
  indexHistoryPrice: IndexHistoryPrice;
  indexDividend: IndexDividend;
  idCounter: number[] = []

  constructor(
    private requirements: HistoryRequirements,
    private uniqueTickers: string[]
  ) {
    this.stockInfo = requirements.stockInfo;
    this.transactions = requirements.transactions
    this.historyData = {};
    this.idCounter = []

    let indexHistoryPrice: IndexHistoryPrice = {};
    for (const ticker of this.uniqueTickers) {
      indexHistoryPrice = HistoryUtils.indexHistoryPrice(
        this.stockInfo[ticker].historyPrice,
        ticker,
        indexHistoryPrice
      );
    }

    let indexDividend: IndexDividend = {};
    for (const ticker of this.uniqueTickers) {
      indexDividend = HistoryUtils.indexDividend(
        this.stockInfo[ticker].dividend,
        indexDividend
      );
    }

    this.indexHistoryPrice = indexHistoryPrice;
    this.indexDividend = indexDividend;

    this.constructHistory();
  }

  getDividendsOnDate(date: string): DividendOnDate {
    let dividendsPaymentOnDate: DividendOnDate = {};
    if (this.indexDividend[date]) {
      const dividends = this.indexDividend[date];

      Object.keys(dividends).map((ticker) => {
        const dividend: Dividend = {
          date: '',
          ticker: '',
          value: 0,
          type: '',
        };

        dividend.date = date;
        dividend.ticker = ticker;
        dividend.value = dividends[ticker].value;
        dividend.type = dividends[ticker].type;

        dividendsPaymentOnDate[ticker] = dividend;
      });
    }
    return dividendsPaymentOnDate;
  }

  getTransactionsOnDate(date: string): TransactionsProps[] {
    const targetDate = new Date(date).getTime();
    const tolerance = 100 * 24 * 60 * 60 * 1000; 
    const sortedTransactions = this.transactions.sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );

    let closestDate: number | null = null;
    let minDiff = Infinity;

    for (const transaction of sortedTransactions) {
      const transactionDate = new Date(transaction.transactionDate).getTime();
      const diff = Math.abs(targetDate - transactionDate);

      if (diff < minDiff && diff <= tolerance) {
        minDiff = diff;
        closestDate = transactionDate;
      }
    }

    if (closestDate !== null) {
      const filtredTransaction = sortedTransactions.filter(
        (transaction) => new Date(transaction.transactionDate).getTime() === closestDate
      );

      const goodTransacitons:TransactionsProps[] = []
      for(const transaction of filtredTransaction) {
        if(!this.idCounter.includes(transaction.id)) {
          this.idCounter.push(transaction.id)
          goodTransacitons.push(transaction);
        }
        else continue;
      }

      return goodTransacitons;
    }

    return [];
  }

  getStocksPriceOnDate(date: string): StockPrice {
    const stockPrice = this.indexHistoryPrice[date];
    const result: StockPrice = {};
    const uniqueTickers: string[] = []

    Object.entries(stockPrice).forEach(([ticker, { price }]) => {
      uniqueTickers.push(ticker, date);
      result[ticker] = { price, ticker };
    });


    return result;
  }

  constructHistory() {
    const dates = Object.keys(this.indexHistoryPrice);
    dates.pop();

    for (const date of dates) {
      const dividends = this.getDividendsOnDate(date);
      const transactions = this.getTransactionsOnDate(date);
      const prices = this.getStocksPriceOnDate(date);

      const chartUpdate = this.chart.updateChart(
        transactions,
        prices,
        dividends,
        date
      );

      this.historyData[date] = {
        date,
        prices,
        dividends,
        transactions,
        chart: chartUpdate,
      };

    }
  }

  static async instanceHistory(transactions: TransactionsProps[]) {
    const { getStock } = await StockDataBase.startDatabase();
    const dividends: Dividend[] = [];
    const stockInfo: StockInfo = {};
    const allTickers = transactions.map((transaction) =>
      transaction.ticker
    );
    const uniqueTickers = Utilities.uniqueElements(allTickers);
    for (const ticker of uniqueTickers) {
      const stock = await getStock(ticker);

      for (const dividend of stock.lastDividendsValue) {
        dividends.push(HistoryUtils.convertLastDividendToDividend(dividend));
      }

      stockInfo[ticker] = {
        stock: stock as StockProps,
        dividend: dividends,
        historyPrice: stock.priceHistory,
      };
    }

    return new History({ stockInfo, transactions }, uniqueTickers);
  }
}