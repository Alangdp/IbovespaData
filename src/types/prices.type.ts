/** Preço de fechamento em uma data (`dd/mm/aa hh:mm`) */
interface PriceObject {
  price: number
  date: string
}

/** Item da resposta de `tickerprice` do statusinvest */
interface MainPrices {
  currencyType: number
  currency: string
  symbol: string
  prices: PriceObject[]
}

/** Preço atual e histórico de preços da ação */
interface PriceReturn {
  price: number
  priceVariation: PriceObject[]
  currency: string
}

export type { MainPrices, PriceObject, PriceReturn }
