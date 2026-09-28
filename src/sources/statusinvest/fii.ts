import * as cheerio from 'cheerio'

import type { RootDividend } from '../../types/dividends.type.js'
import type {
  FiiDividend,
  FiiListItem,
  FiiListResponse,
  FiiPageInfo,
  FiiProperty,
} from '../../types/fii.type.js'
import Utilities from '../../utils/Utilities.js'
import { statusInvestApi } from './http.js'
import { fetchStatusInvestPage } from './page.js'

/** Mais que o total de FIIs listados (cerca de 600), para vir tudo numa página */
const LIST_PAGE_SIZE = 2000

/**
 * Busca todos os FIIs da busca avançada do statusinvest
 *
 * @returns A lista de fundos, ou `null` se a API falhar
 */
export async function fetchFiiList(): Promise<FiiListItem[] | null> {
  const data = await statusInvestApi<FiiListResponse>(
    'category/advancedsearchresultpaginated',
    {
      query: {
        search: '{}',
        page: 0,
        take: LIST_PAGE_SIZE,
        CategoryType: 2,
      },
    },
  )
  return data?.list ?? null
}

/**
 * Baixa o HTML da página do FII
 * (https://statusinvest.com.br/fundos-imobiliarios/:ticker)
 *
 * O statusinvest responde 200 até para ticker inexistente, então a existência
 * do fundo deve ser validada pela listagem antes
 *
 * @throws Error com `403`/`404` na mensagem, que o `errorResponse` reconhece
 */
export async function fetchFiiPage(ticker: string): Promise<string> {
  return fetchStatusInvestPage(`fundos-imobiliarios/${ticker.toLowerCase()}`)
}

/**
 * Extrai CNPJ, administradora e imóveis da página do FII
 *
 * @param html - HTML de https://statusinvest.com.br/fundos-imobiliarios/:ticker
 */
export function parseFiiPage(html: string): FiiPageInfo {
  const $ = cheerio.load(html)
  const fund = $('#fund-section')

  // Busca o CNPJ pelo título do bloco
  const cnpj = fund
    .find('h3.title')
    .filter((_, element) => $(element).text().trim() === 'CNPJ')
    .next('strong.value')
    .text()
    .replace(/\D/g, '')

  // Busca o nome da administradora no cartão "Administrador"
  const administradora = fund
    .find('span.card-title')
    .filter((_, element) => $(element).text().includes('Administrador'))
    .closest('.card')
    .find('.card-body strong')
    .first()
    .text()
    .trim()

  // Carrega os imóveis do portfólio, se a página tiver a seção
  const portfolio = $('#portfolio-section')
  const imoveis = portfolio.length
    ? portfolio
        .find('.property')
        .map((_, element): FiiProperty => {
          const property = $(element)
          const area = property.find('[title="Tamanho"] span').text()
          const vacancia = property
            .find('small.label')
            .filter((_, label) => $(label).text().trim() === 'VACÂNCIA')
            .next('strong.value')
            .text()

          return {
            nome: property.find('.name span').text().trim(),
            uf: property.find('strong.uf').text().trim() || null,
            area: toNumberOrNull(area),
            vacancia: toNumberOrNull(vacancia),
          }
        })
        .get()
    : null

  return {
    cnpj: cnpj || null,
    administradora: administradora || null,
    imoveis,
  }
}

/**
 * Busca os proventos pagos pelo FII, do mais antigo ao mais recente
 *
 * @returns Os proventos, ou `null` se a API falhar
 */
export async function fetchFiiDividends(
  ticker: string,
): Promise<FiiDividend[] | null> {
  // Busca os proventos do fundo
  const data = await statusInvestApi<RootDividend>(
    `fii/companytickerprovents?ticker=${ticker}&chartProventsType=2`,
  )
  // Se a API falhou
  if (!data?.assetEarningsModels) {
    return null
  }

  // Retorna os pagamentos em ordem cronológica (a API traz o mais recente
  // primeiro)
  return data.assetEarningsModels
    .map((payment) => ({
      dataPagamento: payment.pd,
      tipo: payment.et,
      valor: payment.v,
    }))
    .toReversed()
}

/** Converte "58.671,52m²" ou "7,259%" em número; `null` se não houver dígitos */
function toNumberOrNull(text: string): number | null {
  // Se o texto não tem número (ex.: "-%")
  if (!/\d/.test(text)) {
    return null
  }
  return Utilities.formateNumber(text.replace(/m²|%/g, ''))
}
