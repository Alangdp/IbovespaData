import axios, { AxiosError } from 'axios'

// Baixa o HTML da página da ação (https://statusinvest.com.br/acoes/:ticker).
// Erros conhecidos viram mensagens estáveis que o errorResponse reconhece.
export async function fetchStockPage(ticker: string): Promise<string> {
  try {
    const response = await axios.get(
      `https://statusinvest.com.br/acoes/${ticker}`,
      { headers: { 'User-Agent': 'CPI/V1' } },
    )
    return response.data
  } catch (err) {
    if (err instanceof AxiosError) {
      const status = err.response?.status

      if (status === 403) throw new Error('BLOCKED REQUEST CODE 403')
      if (status === 404) throw new Error('INVALID TICKER CODE 404')
    }

    if (err instanceof Error) {
      throw new Error(err.message)
    } else {
      throw new Error('An unknown error occurred')
    }
  }
}
