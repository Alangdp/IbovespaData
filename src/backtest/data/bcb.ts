import axios from 'axios'

import { brToIso } from '../core/dates.js'

/** Série SGS do CDI diário (% ao dia) */
const SERIE_CDI = 12

/**
 * Busca uma série do SGS do Banco Central em um ano (a API limita a janela
 * das séries diárias, por isso a busca é por ano)
 *
 * @param serie - Código da série (ex.: 12 = CDI, 432 = Selic meta)
 * @returns Valor de cada data, como publicado (em geral em %)
 */
export async function fetchSgsAno(
  serie: number,
  ano: number,
): Promise<{ data: string; valor: number }[]> {
  const { data } = await axios.get<{ data: string; valor: string }[]>(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados`,
    {
      params: {
        formato: 'json',
        dataInicial: `01/01/${ano}`,
        dataFinal: `31/12/${ano}`,
      },
      timeout: 60_000,
      // Se o ano ainda não tem dado, a API responde 404
      validateStatus: (status) => status === 200 || status === 404,
    },
  )
  // Se o ano não tem dados
  if (!Array.isArray(data)) {
    return []
  }

  return data
    .map((item) => ({
      data: brToIso(item.data) ?? '',
      valor: Number(item.valor),
    }))
    .filter((item) => item.data !== '' && Number.isFinite(item.valor))
}

/**
 * Busca a taxa diária do CDI de um ano
 *
 * @returns Taxa de cada dia útil, em fração ao dia
 */
export async function fetchCdiAno(
  ano: number,
): Promise<{ data: string; taxa: number }[]> {
  return (await fetchSgsAno(SERIE_CDI, ano)).map((item) => ({
    data: item.data,
    taxa: item.valor / 100,
  }))
}
