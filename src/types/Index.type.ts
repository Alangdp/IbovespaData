import { Dividend } from './dividends.type';

export type IndexHistoryPrice = {
  [date: string]: {
    [ticker: string]: {
      price: number;
    };
  };
};

export type IndexDividend = {
  [date: string]: {
    [ticker: string]: Dividend;
  };
};
