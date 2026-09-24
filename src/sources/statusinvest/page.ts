import axios, { AxiosError } from 'axios'

/**
 * Baixa o HTML de uma página do statusinvest
 *
 * @param path - Caminho da página (ex.: `acoes/petr4`)
 * @returns O HTML da página
 * @throws Error com `403`/`404` na mensagem, que o `errorResponse` reconhece
 */
export async function fetchStatusInvestPage(path: string): Promise<string> {
  try {
    // Busca a página
    const response = await axios.get<string>(
      `https://statusinvest.com.br/${path}`,
      { headers: { 'User-Agent': 'CPI/V1' } },
    )
    return response.data
  } catch (err) {
    const status = err instanceof AxiosError ? err.response?.status : undefined

    // Se o statusinvest bloqueou a requisição
    if (status === 403) {
      throw new Error('BLOCKED REQUEST CODE 403')
    }
    // Se o ticker não existe
    if (status === 404) {
      throw new Error('INVALID TICKER CODE 404')
    }
    // Retorna um Error simples: um AxiosError cairia no ramo de erro da
    // própria API no errorResponse
    throw new Error(err instanceof Error ? err.message : String(err))
  }
}

/**
 * Baixa o HTML da página da ação (https://statusinvest.com.br/acoes/:ticker)
 *
 * @param ticker - Código da ação (ex.: PETR4)
 * @returns O HTML da página
 * @throws Error com `403`/`404` na mensagem, que o `errorResponse` reconhece
 */
export async function fetchStockPage(ticker: string): Promise<string> {
  return fetchStatusInvestPage(`acoes/${ticker}`)
}
