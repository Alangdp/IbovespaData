import * as cheerio from 'cheerio'

import type { FetcherUtilsProtocol } from './../interfaces/FetcherUtils.type'
import Utilities from './Utilities.js'

export default class FetcherUtils implements FetcherUtilsProtocol {
  private $?: cheerio.CheerioAPI

  constructor(html?: string) {
    if (html) this.$ = cheerio.load(html)
  }

  extractText(selector: string): string {
    if (!this.$) throw new Error('Invalid $')
    return this.$(selector).text() || ''
  }

  extractImage(selector: string): string {
    if (!this.$) throw new Error('Invalid $')
    const element = this.$(selector)
    try {
      let img = element.attr('data-img') || ''
      img = img.split('(')[1].split(')')[0]
      img = `https://statusinvest.com.br/${img}`
      return img
    } catch (err) {
      return 'https://spassodourado.com.br/wp-content/uploads/2015/01/default-placeholder.png'
    }
  }

  extractNumber(selector: string): number {
    if (!this.$) throw new Error('Invalid $')
    return Utilities.formateNumber(this.extractText(selector))
  }
}
