import type { MainPrices, PriceReturn } from '../../types/prices.type.js'
import { statusInvestApi } from './http.js'

/**
 * Busca o histórico de preços da ação (últimos 5 anos)
 *
 * @param ticker - Código da ação (ex.: PETR4)
 * @returns O preço atual e o histórico, ou `null` se a API falhar
 */
export async function fetchPrices(ticker: string): Promise<PriceReturn | null> {
  // Busca o histórico de preços
  const data = await statusInvestApi<MainPrices[]>('acao/tickerprice', {
    method: 'POST',
    query: { ticker, type: 4, 'currences[]': '1' },
  })
  // Se a API falhou ou não trouxe preços
  if (!data?.[0]?.prices?.length) {
    return null
  }

  // Retorna o último preço como preço atual
  const { prices, currency } = data[0]
  return {
    price: prices[prices.length - 1].price,
    priceVariation: prices,
    currency,
  }
}
