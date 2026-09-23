import type { MainPrices, PriceReturn } from '../../types/prices.type.js'
import { statusInvestApi } from './http.js'

// Histórico de preços (últimos 5 anos). Devolve null se a API falhar.
export async function fetchPrices(ticker: string): Promise<PriceReturn | null> {
  try {
    const data = await statusInvestApi<MainPrices[]>(
      {
        method: 'POST',
        params: { ticker, type: 4, 'currences[]': '1' },
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'CPI/V1',
        },
      },
      'tickerprice',
    )
    if (!data) throw new Error('Error Getting Prices Data')

    return {
      price: data[0].prices[data[0].prices.length - 1].price,
      priceVariation: data[0].prices,
      currency: data[0].currency,
    }
  } catch (error) {
    return null
  }
}
