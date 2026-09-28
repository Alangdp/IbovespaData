import * as cheerio from 'cheerio'

import Utilities from './Utilities.js'

const PLACEHOLDER_IMAGE =
  'https://spassodourado.com.br/wp-content/uploads/2015/01/default-placeholder.png'

/** Extrai textos, números e imagens de uma página HTML por seletor CSS */
export default class FetcherUtils {
  private readonly $: cheerio.CheerioAPI

  /** @param html - HTML completo da página */
  constructor(html: string) {
    this.$ = cheerio.load(html)
  }

  /** Retorna o texto do elemento, ou string vazia se ele não existir */
  extractText(selector: string): string {
    return this.$(selector).text()
  }

  /**
   * Retorna a URL da imagem guardada no atributo `data-img` (formato
   * `url(/caminho)`), ou uma imagem genérica se o atributo não existir
   */
  extractImage(selector: string): string {
    // Busca o caminho entre os parênteses
    const path = this.$(selector)
      .attr('data-img')
      ?.match(/\(([^)]*)\)/)?.[1]

    // Se o elemento não tem imagem
    if (path === undefined) {
      return PLACEHOLDER_IMAGE
    }
    return `https://statusinvest.com.br/${path}`
  }

  /** Retorna o texto do elemento convertido para número (ver `formateNumber`) */
  extractNumber(selector: string): number {
    return Utilities.formateNumber(this.extractText(selector))
  }
}
