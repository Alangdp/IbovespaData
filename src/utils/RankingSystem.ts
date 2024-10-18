import { Bazin } from '../Entities/Bazin.js';
import { StockProps } from '../types/stock.types.js';
import { StockDataBase } from '../useCases/stockDataBase.js';
import Json from './Json.js';
import TickerFetcher from '../useCases/Fetcher.js';
import { Pontuation } from '../Entities/Pontuation.js';
import { PontuationDataBase } from '../useCases/PontuationDatabase.js';

// FIXME ARRUMAR SOLID AQUI
// FIXME FUNÇÃO TEMPORARIA

type RankingSystyemProps = {
  tickers: string[];
};

interface Ranking {
  [ticker: string]: Pontuation;
}

class RankingSystyem {
  private tickers: string[];
  private ranking: Ranking;

  async execute() {
    for (const ticker of this.tickers) {
      try {
        await PontuationDataBase.get({ ticker, type: 'BAZIN' });
      } catch (error) {
        error;
        continue;
      }
    }
  }

  constructor({ tickers }: RankingSystyemProps) {
    this.tickers = tickers;
    this.ranking = {};
  }
}
