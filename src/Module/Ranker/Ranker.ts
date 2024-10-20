import { MongooConnection } from '../../database';
import { StockProps } from '../../types/stock.types';
import { StockDataBase } from '../../useCases/stockDataBase';

interface RankerInterface {
  ticker: string;
  stock: StockProps;
}

export default class Ranker {
  private ticker: string;
  public stock: StockProps;

  constructor({ ticker, stock }: RankerInterface) {
    this.ticker = ticker;
    this.stock = stock;
  }

  static async instance(ticker: string) {
    const { getStock } = await StockDataBase.startDatabase();
    const stock = await getStock(ticker);
    const instance = new Ranker({ ticker: ticker, stock });
    return instance;
  }
}

async function main() {
  const ticker = 'TAEE11';

  const ranker = await Ranker.instance(ticker);
  const lastDividendsYieldYear = ranker.stock.lastDividendsYieldYear;

  const date = new Date();

  type Teste = {
    [key: string]: {
      value: number;
      label: string;
    };
  };
  const obj: Teste = {};
  await MongooConnection.destroy();
}

main();
