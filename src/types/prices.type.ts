interface PriceObject {
  price: number
  date: string
}

interface MainPrices {
  currencyType: number
  currency: string
  symbol: string
  prices: PriceObject[]
}

interface PriceReturn {
  price: number
  priceVariation: PriceObject[]
  currency: string
}

type RootPrices = MainPrices[]

export { RootPrices, PriceObject, PriceReturn, MainPrices }
