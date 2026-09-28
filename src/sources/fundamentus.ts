import axios from 'axios'
import * as cheerio from 'cheerio'

/**
 * Lista todos os tickers negociados na B3, lidos da tabela de resultados do
 * fundamentus (https://www.fundamentus.com.br/resultado.php)
 *
 * @throws AxiosError se a página não puder ser baixada
 */
export async function fetchAllTickers(): Promise<string[]> {
  // Busca a tabela de resultados
  const response = await axios.get<string>(
    'https://www.fundamentus.com.br/resultado.php',
    { headers: { 'user-agent': 'CPI/V1', 'content-length': 0 } },
  )

  // Retorna o texto dos links da tabela (um por ticker)
  const $ = cheerio.load(response.data)
  return $('td span a')
    .map((_index, element) => $(element).text())
    .get()
}
