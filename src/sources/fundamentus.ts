import axios from 'axios'
import * as cheerio from 'cheerio'

// Lista todos os tickers negociados, lida da tabela de resultados do
// fundamentus (https://www.fundamentus.com.br/resultado.php).
export async function fetchAllTickers(): Promise<string[]> {
  try {
    const response = await axios.request({
      method: 'GET',
      url: 'https://www.fundamentus.com.br/resultado.php',
      headers: { 'user-agent': 'CPI/V1', 'content-length': 0 },
    })

    const $ = cheerio.load(response.data)
    return $('td span a')
      .map((index, element) => $(element).text())
      .get()
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(err.message)
    } else {
      throw new Error('An unknown error occurred')
    }
  }
}
