import { VariableProps } from '../interfaces/Variable.type.js';
import { PriceHistory } from '../types/stock.types.js';

export abstract class Variable implements VariableProps{
  ticker: string;
  name: string;
  activeValue: number;
  shareQuantity: number;
  actualPrice: number;
  marketValue: number;
  instanceTime: number = new Date().getTime();
  priceHistory: PriceHistory[];

  abstract calculateRentability(
    actualPrice: number,
    referencePrice: number
  ): number;

  constructor(
    { 
      activeValue,
      actualPrice,
      name,
      priceHistory,
      shareQuantity,
      ticker,
    }: VariableProps
  ) {
    this.ticker = ticker;
    this.name = name;
    this.priceHistory = priceHistory;
    this.actualPrice = actualPrice;
    this.marketValue = actualPrice * activeValue;
    this.shareQuantity = shareQuantity;
    this.activeValue = activeValue;
  }
}
