import { PriceHistory } from "../types/stock.types";

export interface VariableProps {
  ticker: string,
  name: string,
  activeValue: number,
  shareQuantity: number,
  actualPrice: number,
  priceHistory: PriceHistory[]
}