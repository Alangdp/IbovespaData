import axios from 'axios'

const BASE_URL = 'https://statusinvest.com.br'

/** Opções de uma consulta às APIs JSON do statusinvest */
interface StatusInvestRequest {
  method?: 'GET' | 'POST'
  /** Parâmetros enviados na query string (corpo JSON) */
  query?: Record<string, unknown>
  /** Corpo já codificado como `application/x-www-form-urlencoded` */
  form?: string
}

/**
 * Ponto único de acesso às APIs JSON do statusinvest
 *
 * Cada consulta desta pasta (dividendos, indicadores, preços...) só monta os
 * parâmetros e converte a resposta
 *
 * @param path - Caminho depois do domínio (ex.: `acao/payoutresult?code=PETR4`)
 * @param request - Método e parâmetros da consulta
 * @returns O corpo da resposta, ou `null` em qualquer falha de rede/HTTP
 */
export async function statusInvestApi<T>(
  path: string,
  { method = 'GET', query, form }: StatusInvestRequest = {},
): Promise<T | null> {
  try {
    // Efetua a consulta
    const response = await axios.request<T>({
      method,
      url: `${BASE_URL}/${path}`,
      headers: {
        'Content-Type': form
          ? 'application/x-www-form-urlencoded'
          : 'application/json',
        cookie: '_adasys=b848d786-bc93-43d6-96a6-01bb17cbc296',
        'user-agent': 'CPI/V1',
      },
      params: query,
      data: form,
    })
    return response.data
  } catch {
    return null
  }
}
