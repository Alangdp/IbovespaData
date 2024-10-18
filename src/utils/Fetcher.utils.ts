import cheerio from 'cheerio';
import { FetcherUtilsProtocol } from './../interfaces/FetcherUtils.type';

import Utilities from './Utilities.js';

type CherioElement = cheerio.Cheerio;

export default class FetcherUtils implements FetcherUtilsProtocol {
  private $?: cheerio.Root;

  constructor(html?: string) {
    if (html) this.$ = cheerio.load(html);
  }

  extractText(selector: string): string {
    if (!this.$) throw new Error('Invalid $');
    const element = this.$(selector) || null;
    if (!element) return '';
    return element.text() || '';
  }

  extractElement(selector: string): CherioElement | undefined {
    if (!this.$) throw new Error('Invalid $');
    const element = this.$(selector);
    if (element === null) {
      return undefined;
    }
    return element;
  }

  extractImage(selector: string): string {
    if (!this.$) throw new Error('Invalid $');
    const element = this.$(selector);
    if (element === null) return '';
    try {
      let img = element.attr('data-img') || '';
      img = img.split('(')[1].split(')')[0];
      img = `https://statusinvest.com.br/${img}`;
      return img;
    } catch (err: any) {
      return 'https://spassodourado.com.br/wp-content/uploads/2015/01/default-placeholder.png';
    }
  }

  extractNumber(selector: string): number {
    if (!this.$) throw new Error('Invalid $');
    return Utilities.formateNumber(this.extractText(selector));
  }
}
