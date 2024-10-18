type RootPrices = MainPrices[];

interface MainPrices {
  currencyType: number;
  currency: string;
  symbol: string;
  prices: PriceObject[];
}

interface PriceObject {
  price: number;
  date: string;
}

interface PriceReturn {
  price: number;
  priceVariation: PriceObject[];
  currency: string;
}

export { RootPrices, PriceObject, PriceReturn, MainPrices };
