import type { BasicInfoReturn } from '../../types/BasicInfo.type.js'
import Scrapper from '../../utils/Fetcher.utils.js'

// Seletores CSS dos campos da página da ação. São frágeis: qualquer mudança
// no layout do statusinvest quebra a extração (o teste golden acusa).
const selectors = {
  imageURL:
    '#company-section > div:nth-child(1) > div > div.d-block.d-md-flex.mb-5.img-lazy-group > div.company-brand.w-100.w-md-30.p-3.rounded.mb-3.mb-md-0.bg-lazy',
  totalStocksInCirculation:
    'div[title="Total de papéis disponíveis para negociação"] div strong',
  freeFloat:
    '#company-section > div:nth-child(1) > div > div.top-info.info-3.sm.d-flex.justify-between.mb-3 > div:nth-child(11) > div > div > strong',
  netEquity:
    '#company-section > div:nth-child(1) > div > div.top-info.info-3.sm.d-flex.justify-between.mb-3 > div:nth-child(1) > div > div > strong',
  marketValue:
    '#company-section > div:nth-child(1) > div > div.top-info.info-3.sm.d-flex.justify-between.mb-3 > div:nth-child(7) > div > div > strong',
  price:
    '#main-2 > div:nth-child(4) > div > div.pb-3.pb-md-5 > div > div.info.special.w-100.w-md-33.w-lg-20 > div > div:nth-child(1) > strong',
  porcentLast12Days:
    '#main-2 > div:nth-child(4) > div > div.pb-3.pb-md-5 > div > div:nth-child(5) > div > div:nth-child(1) > strong',
  dividendPorcent:
    '#main-2 > div:nth-child(4) > div > div.pb-3.pb-md-5 > div > div:nth-child(4) > div > div:nth-child(1) > strong',
  name: 'title',
  LPA: '#indicators-section > div.indicator-today-container > div > div:nth-child(1) > div > div:nth-child(11) > div > div > strong',
  VPA: '#indicators-section > div.indicator-today-container > div > div:nth-child(1) > div > div:nth-child(9) > div > div > strong',
  liquidPatrimony:
    '#company-section > div:nth-child(1) > div > div.top-info.info-3.sm.d-flex.justify-between.mb-3 > div:nth-child(1) > div > div > strong',
  grossDebt:
    '#company-section > div:nth-child(1) > div > div.top-info.info-3.sm.d-flex.justify-between.mb-3 > div:nth-child(4) > div > div > strong',
  shareQuantity:
    '#company-section > div:nth-child(1) > div > div.top-info.info-3.sm.d-flex.justify-between.mb-3 > div:nth-child(9) > div > div > strong',
  segment:
    '#company-section > div:nth-child(1) > div > div.card.bg-main-gd-h.white-text.rounded.ov-hidden.pt-0.pb-0 > div > div:nth-child(3) > div > div > div > a > strong',
}

// Extrai os dados básicos da ação a partir do HTML da página.
export function parseBasicInfo(html: string, ticker: string): BasicInfoReturn {
  const page = new Scrapper(html)

  const dividendPorcent = page.extractNumber(selectors.dividendPorcent)

  return {
    ticker,
    image: page.extractImage(selectors.imageURL),
    name: page.extractText(selectors.name),
    price: page.extractNumber(selectors.price),
    dividendPorcent,
    dividendDecimal: dividendPorcent / 100,
    porcentLast12Days: page.extractNumber(selectors.porcentLast12Days),
    totalStocksInCirculation: page.extractText(
      selectors.totalStocksInCirculation,
    ),
    freeFloat: page.extractNumber(selectors.freeFloat),
    netEquity: page.extractText(selectors.netEquity),
    marketValue: page.extractText(selectors.marketValue),
    LPA: page.extractNumber(selectors.LPA),
    VPA: page.extractNumber(selectors.VPA),
    liquidPatrimony: page.extractNumber(selectors.liquidPatrimony),
    grossDebt: page.extractNumber(selectors.grossDebt),
    shareQuantity: page.extractNumber(selectors.shareQuantity),
    segment: page.extractText(selectors.segment),
  }
}
