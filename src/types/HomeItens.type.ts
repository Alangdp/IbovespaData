export interface ItemData {
  ticker: string;
  companyName: string;
  variation: string;
  currentPrice: string;
}

export interface HomeItens {
  lows: ItemData[];
  high: ItemData[];
  dividends: ItemData[];
  Announcements: ItemData[];
}
