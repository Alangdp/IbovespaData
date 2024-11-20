import { RootCashFlow } from '../types/cashFlow.type.js';
import { DividendReturn, RootDividend } from '../types/dividends.type.js';
import { Header } from '../types/get.type.js';
import { MainPrices, PriceReturn } from '../types/prices.type.js';
import axios, { AxiosRequestConfig } from 'axios';
import Cheerio from 'cheerio';

import Scrapper from '../utils/Fetcher.utils.js';
import Utilities from '../utils/Utilities.js';
import { IndicatorRoot, IndicatorsData } from '../types/indicators.type.js';
import apiGetter from '../utils/ApiGetter.js';
import { PayoutReturn, RootPayout } from '../types/Payout.type.js';
import {
  PassiveChart,
  PassiveChartReturn,
} from '../types/PassiveChart.type.js';
import { ReportReturn, RootReport } from '../types/report.type.js';
import { BasicInfoReturn } from '../types/BasicInfo.type.js';
import { StockQuery } from '../types/QueryStock.type.js';
import { Segment } from '../types/Segment.type.js';
import { DReRoot, DreData, ValuesData } from '../types/DRE.type.js';
import { HomeItens, ItemData } from '../types/HomeItens.type.js';
import { News, NewsAPI } from '../types/News.type.js';

// FIXME REFAZER TUDO AQUI
// TODO - ROE INCORRETO CONSERTAR

export default class TickerFetcher {
  public ticker: string;
  private Utility?: Scrapper;
  private type?: string;
  private actualyear: number = new Date().getFullYear();

  constructor(ticker: string) {
    this.ticker = ticker;
  }

  async initialize(): Promise<this> {
    const htmlPage: string = await this.getHtmlPage();
    this.Utility = new Scrapper(htmlPage);

    return this;
  }

  async getHtmlPage() {
    try {
      return (
        await axios.get(`https://statusinvest.com.br/acoes/${this.ticker}`, {
          headers: {
            'User-Agent': 'CPI/V1',
          },
        })
      ).data;
    } catch (err: any) {
      const status = err.response.status;

      if (status === 403) throw new Error('BLOCKED REQUEST CODE 403');
      if (status === 404) throw new Error('INVALID TICKER CODE 404');
      throw new Error(err.message);
    }
  }

  async getBasicInfo() {
    if (!this.Utility) {
      throw new Error('Utility not initialized.');
    }

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
    };

    const totalStocksInCirculation: string = this.Utility.extractText(
      selectors.totalStocksInCirculation
    );
    const freeFloat: number = this.Utility.extractNumber(selectors.freeFloat);
    const netEquity: string = this.Utility.extractText(selectors.netEquity);
    const marketValue: string = this.Utility.extractText(selectors.marketValue);
    const price: number = this.Utility.extractNumber(selectors.price);
    const porcentLast12Days: number = this.Utility.extractNumber(
      selectors.porcentLast12Days
    );
    const dividendPorcent: number = this.Utility.extractNumber(
      selectors.dividendPorcent
    );
    const dividendDecimal: number = dividendPorcent / 100;
    const name: string = this.Utility.extractText(selectors.name);
    const LPA: number = this.Utility.extractNumber(selectors.LPA);
    const VPA: number = this.Utility.extractNumber(selectors.VPA);
    const liquidPatrimony: number = this.Utility.extractNumber(
      selectors.liquidPatrimony
    );

    const grossDebt = this.Utility.extractNumber(selectors.grossDebt);
    const shareQuantity = this.Utility.extractNumber(selectors.shareQuantity);
    const segment = this.Utility.extractText(selectors.segment);
    let image = this.Utility.extractImage(selectors.imageURL);

    const data: BasicInfoReturn = {
      ticker: this.ticker,
      image,
      name,
      price,
      dividendPorcent,
      dividendDecimal,
      porcentLast12Days,
      totalStocksInCirculation,
      freeFloat,
      netEquity,
      marketValue,
      LPA,
      VPA,
      liquidPatrimony,
      grossDebt,
      shareQuantity,
      segment,
    };

    return data;
  }

  static async getAllTickers(): Promise<string[]> {
    try {
      const options = {
        method: 'GET',
        url: `https://www.fundamentus.com.br/resultado.php`,
        headers: {
          'user-agent': 'CPI/V1',
          'content-length': 0,
        },
      };

      const response = await axios.request(options);

      const $ = Cheerio.load(response.data);
      const tickers: string[] = $('td span a')
        .map((index, element) => $(element).text())
        .get();

      return tickers;
    } catch (error: any) {
      console.log(error);
      throw new Error('Error fetching tickers');
    }
  }

  async getStockrebuy(): Promise<any[]> {
    const selectors = {
      table: '#movements-section > div > div.buyback.card > div.card-body',
      types:
        '.w-100.w-lg-50.mt-2.mb-3.mb-sm-2.d-xs-flex.justify-center.align-items-center',
      status:
        '.w-100.w-lg-50.d-flex.flex-wrap.justify-around.align-items-center',
    };

    const rebuyInfo = [];

    const tempObject = {
      status: null,
      approvedDate: null,
      startDate: null,
      endDate: null,
      stocksQuantity: null,
      stockType: null,
    };

    const tableRows = this.Utility?.extractElement(selectors.table);
    if (!tableRows) return [];

    for (const tableRow of tableRows) {
      const rowContent: any = Cheerio(tableRow).html();
      const rows = Cheerio.load(rowContent, {});

      const status = this.Utility?.extractElement(selectors.status);
      const types = this.Utility?.extractElement(selectors.types);
      if (status === undefined || types === undefined) return [];

      const statusTextArray = Cheerio(status)
        .map((index: number, element: cheerio.Element) => {
          return rows(element).text();
        })
        .get();

      const infosText = Cheerio(types)
        .each((index: number, element: cheerio.Element) => {
          return rows(element).text();
        })
        .get();

      for (let i = 0; i < statusTextArray.length; i++) {
        const linesStatus = statusTextArray[i].trim().split('\n');
        const linesInfo = infosText[i].trim().split('\n');

        const tempObject = {
          status: linesStatus[0],
          approvedDate: linesStatus[5].replace('APROVADO EM\n', ''),
          startDate: linesStatus[9].replace('DATA DE INÍCIO\n', ''),
          endDate: linesStatus[13].replace('DATA DE FIM\n', ''),
          stocksQuantity: linesInfo[5],
          stockType: linesInfo[1],
        };

        rebuyInfo.push(tempObject);
      }
    }

    return rebuyInfo;
  }

  async getSegment(): Promise<Segment | null> {
    {
      try {
        const paths = {
          finalSegment:
            '#company-section > div:nth-child(1) > div > div.card.bg-main-gd-h.white-text.rounded.ov-hidden.pt-0.pb-0 > div > div:nth-child(3) > div > div > div > a > strong',
        };

        const segmentFinal = this.Utility?.extractText(paths.finalSegment);

        if (!segmentFinal) throw Error('Invalid Tickers');
        return { segmentFinal };
      } catch (error) {
        return null;
      }
    }
  }

  async getDividendInfo() {
    const ticker = this.ticker;

    const dividendReturn: DividendReturn = {
      lastDividendPayments: [],
      lastDividendPaymentsYear: [],
      helper: {
        earningsThisYearHelper: '',
        earningsLastYearHelper: '',
        earningsProvisionedHelper: '',
        earningsMainTextHelper: '',
      },
      dividendPaymentThisYear: 0,
      dividendPaymentLastYear: 0,
    };

    try {
      const data = await apiGetter<RootDividend>(
        {
          method: 'GET',
          headers: {},
        },
        `companytickerprovents?ticker=${ticker}&chartProventsType=2`
      );
      if (!data) throw new Error('Error Getting Dividends Data');

      const formatNumber = Utilities.formateNumber;

      dividendReturn.helper.earningsLastYearHelper =
        data.helpers.earningsLastYearHelper;
      dividendReturn.helper.earningsMainTextHelper =
        data.helpers.earningsMainTextHelper;
      dividendReturn.helper.earningsProvisionedHelper =
        data.helpers.earningsProvisionedHelper;
      dividendReturn.helper.earningsThisYearHelper =
        data.helpers.earningsThisYearHelper;

      dividendReturn.dividendPaymentLastYear = formatNumber(
        data.earningsLastYear
      );
      dividendReturn.dividendPaymentThisYear = formatNumber(
        data.earningsThisYear
      );

      for (const dividendYear of data.assetEarningsYearlyModels) {
        dividendReturn.lastDividendPaymentsYear.push({
          year: dividendYear.rank,
          value: dividendYear.value,
        });
      }

      for (const dividendPayment of data.assetEarningsModels) {
        dividendReturn.lastDividendPayments.push({
          ticker,
          dataCom: dividendPayment.ed,
          dataEx: dividendPayment.pd,
          dividendType: dividendPayment.et,
          dividendTypeName: dividendPayment.etd,
          value: dividendPayment.v,
        });
      }

      return dividendReturn;
    } catch (error) {
      return null;
    }
  }

  async getIndicatorsInfo() {
    const ticker = this.ticker;

    const data = await apiGetter<IndicatorRoot>(
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        params: `codes%5B%5D=${ticker}&time=7&byQuarter=false&futureData=false`,
      },
      'indicatorhistoricallist'
    );
    if (!data) throw new Error('Error Getting Indicators Data');

    const indicatorsData: IndicatorsData = {};
    const tickerReference = Object.keys(data.data)[0];
    for (const item of data.data[tickerReference]) {
      indicatorsData[item.key] = {
        actual: item.actual,
        avg: item.avg,
        olds: item.ranks.map((data) => {
          return {
            date: data.rank,
            value: data.value ?? 0,
          };
        }),
      };
    }

    return indicatorsData;
  }

  async getDreInfo() {
    const ticker = this.ticker;

    try {
      const data = await apiGetter<DReRoot>(
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        `getdre?code=${ticker}&type=0&futureData=false&range.min=2009&range.max=2022`
      );

      if (!data) throw new Error('Error getting DRE DATA');

      const DreData: DreData = {};

      for (const item of data.data['grid']) {
        const key = item.gridLineModel?.key;
        const values = item.gridLineModel?.values;
        const valuesToSave: ValuesData = {};

        if (values) {
          for (let i = 0; i < values.length; i++) {
            valuesToSave[(new Date().getFullYear() - (i + 1)).toString()] = {
              date: (new Date().getFullYear() - (i + 1)).toString(),
              value: values[i],
            };
          }
        }

        if (key && values) {
          DreData[key] = {
            actual: values[0],
            values: valuesToSave,
          };
        }
      }

      return DreData;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async getPrice() {
    const ticker = this.ticker;

    try {
      const data = await apiGetter<MainPrices[]>(
        {
          method: 'POST',
          params: {
            ticker: ticker,
            type: 4,
            'currences[]': '1',
          },
          headers: {
            'Content-Type': 'application/json',
            'user-agent': 'CPI/V1',
          },
        },
        'tickerprice'
      );

      if (!data) throw new Error('Error Getting Prices Data');

      const priceReturn: PriceReturn = {
        price: data[0].prices[data[0].prices.length - 1].price,
        priceVariation: data[0].prices,
        currency: data[0].currency,
      };

      return priceReturn;
    } catch (error) {
      return null;
    }
  }

  async getPayout() {
    const ticker = this.ticker;

    try {
      const data = await apiGetter<RootPayout>(
        {
          method: 'GET',
          headers: {},
          params: {
            code: ticker,
            type: 1,
          },
        },
        `payoutresult?code=${ticker}`
      );
      if (!data) throw new Error('Error Getting Payout Data');

      const payoutReturn: PayoutReturn = {
        actual: data.actual,
        average: data.avg | data.actual,
        minValue: data.minValue,
        maxValue: data.maxValue,
        chart: data.chart,
      };

      return payoutReturn;
    } catch (error) {
      return null;
    }
  }

  async getPassiveChart(): Promise<PassiveChartReturn[] | null> {
    const ticker = this.ticker;

    try {
      const data = await apiGetter<PassiveChart[]>(
        {
          method: 'GET',
          headers: {},
        },
        `getbsactivepassivechart?code=${ticker}&type=1`
      );
      if (!data) throw new Error('Error Getting Payout Data');
      const dataFormated: PassiveChartReturn[] = [];
      for (const passiveObject of data) {
        dataFormated.push({
          year: passiveObject.year,
          totalAssets: passiveObject.ativoTotal,
          totalLiabilities: passiveObject.passivoTotal,
          currentAssets: passiveObject.ativoCirculante,
          nonCurrentAssets: passiveObject.ativoNaoCirculante,
          currentLiabilities: passiveObject.passivoCirculante,
          nonCurrentLiabilities: passiveObject.passivoNaoCirculante,
          shareholdersEquity: passiveObject.patrimonioLiquido,
        });
      }

      return dataFormated;
    } catch (error) {
      return null;
    }
  }

  async getReports(): Promise<ReportReturn[] | null> {
    const ticker = this.ticker;

    try {
      const returnData: ReportReturn[] = [];

      const data = await apiGetter<RootReport>(
        {
          method: 'POST',
          params: {
            code: ticker,
            year: this.actualyear,
          },
          headers: {},
        },
        'getassetreports'
      );
      if (!data) throw new Error('Error Getting Report Data');

      for (const report of data.data) {
        returnData.push({
          year: report.year.toString(),
          rank: 0,
          referenceDate: report.dataReferencia_F,
          type: report.tipo,
          especie: report.especie,
          assunt: report.assunto,
          linkPdf: report.linkPdf,
        });
      }

      return returnData;
    } catch (error) {
      return null;
    }
  }

  // TODO REFAZER ESSA FUNCAO TODA
  async getCashFlow(): Promise<Header[] | null> {
    const ticker = this.ticker;
    try {
      const data = await apiGetter<RootCashFlow>(
        {
          method: 'GET',
          headers: {},
        },
        `getfluxocaixa?code=${ticker}&range.min=${2000}&range.max=${
          this.actualyear - 1
        }`
      );
      if (!data) throw new Error('Error Getting CashFlow Data');

      const grid = data.data.grid;
      const header: Header[] = [];
      const yearsOrdened: string[] = grid[0].columns
        .map((item: any) => {
          if (item.name === 'DATA') {
            return item.value;
          }
        })
        .filter((item: any) => item !== undefined);

      let count = 0;
      yearsOrdened.forEach((year: string) => {
        header.push({
          name: year,
          index: count,
          value: {},
        });
        count++;
      });

      for (let i = 0; i < grid.length; i++) {
        if (i === 0) continue;

        const gridLineModel = grid[i].gridLineModel;

        if (gridLineModel !== undefined) {
          const key = gridLineModel?.key;

          header.forEach((item: Header, index: number) => {
            if (
              key === undefined ||
              gridLineModel === undefined ||
              gridLineModel.values === undefined
            ) {
              return;
            }

            const values = gridLineModel.values as (number | undefined)[];

            if (values[index] === undefined) {
              return;
            }

            item.value[key] = values[index] as number;
          });
        }
      }

      return header;
    } catch (error) {
      return null;
    }
  }

  async getImage() {
    const ticker = this.ticker;

    try {
      const data = await apiGetter<StockQuery[]>(
        {
          method: 'GET',
          headers: {},
          url: 'home',
        },
        `mainsearchquery?q=${ticker}`
      );
      if (!data) throw new Error('Error Getting Image Data');
      return data;
    } catch (error) {
      return null;
    }
  }

  static async getHighsAndLows() {
    async function getHtmlPage() {
      try {
        return (
          await axios.get(`https://statusinvest.com.br/`, {
            headers: {
              'User-Agent': 'CPI/V1',
            },
          })
        ).data;
      } catch (err: any) {
        throw new Error(err.message);
      }
    }

    try {
      const $ = Cheerio;
      const html = await getHtmlPage();
      const scrapper = new Scrapper(html);

      const selectors = {
        listItem: '[role="listitem"]',
      };

      const listItems = scrapper.extractElement(selectors.listItem);

      if (!listItems) {
        throw new Error('Não foi possível encontrar os itens da lista.');
      }

      const categorizedItems: HomeItens = {
        lows: [],
        high: [],
        dividends: [],
        Announcements: [],
      };

      listItems.each((i, item) => {
        if (i > 23) return;
        const $item = $(item);
        const ticker = $item.find('h4').text().trim();
        const companyName = $item.find('h4 small').text().trim();
        const variation = $item.find('.main-info .value').text().trim();
        const currentPrice = $item
          .find('.main-info .other-value')
          .text()
          .trim();

        const itemData: ItemData = {
          ticker,
          companyName,
          variation: variation,
          currentPrice,
        };

        if (variation.includes('R$')) {
          categorizedItems.dividends.push(itemData);
        } else if (variation.includes('comunicado')) {
          categorizedItems.Announcements.push(itemData);
        } else if (variation.includes('arrow_upward')) {
          categorizedItems.high.push(itemData);
        } else if (variation.includes('arrow_downward')) {
          categorizedItems.lows.push(itemData);
        }
      });

      return categorizedItems;
    } catch (error: any) {
      console.log('Erro:', error.message);
      return null;
    }
  }

  static async getNews(): Promise<News[] | null> {
    try {
      const response = await axios.get(
        'https://br.tradingview.com/markets/stocks-brazil/news/'
      );
      const $ = Cheerio.load(response.data);

      const jsonData = $("script[type='application/prs.init-data+json']")
        .eq(3)
        .html();

      let data: NewsAPI;
      if (jsonData) {
        data = JSON.parse(jsonData);
      } else {
        throw new Error('No JSON data found in the script tag.');
      }

      const news: News[] = [];
      for (const item of data[Object.keys(data)[0]].data.news.data.items) {
        const title = item.title;
        const published = item.published;
        const sponsor = item.provider;
        const symbols = item.relatedSymbols.map((symbol) => symbol.symbol);
        const symbolsURL = item.relatedSymbols.map((symbol) => symbol.logoid);
        const link = item.storyPath;
        const secondary_link = item.link;

        news.push({
          title,
          published,
          sponsor,
          symbols,
          link,
          secondary_link,
          content: [],
          symbolsSVG: symbolsURL,
        });
      }

      // console.log(news[0]);

      return await this.getNewContent(news);
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  private static async getNewContent(news: News[]) {
    const updatedNews: News[] = [];
    for (const item of news) {
      if (!item.link || item.symbols.length === 0) continue;

      const response = await axios.get(
        `https://br.tradingview.com${item.link}`
      );
      const $ = Cheerio.load(response.data);
      const content = $(
        '#tv-content > div > div > div > article > div.body-KX2tCBZq.bodyPreview-pIO_GYwT.body-pIO_GYwT.content-pIO_GYwT.body-RYg5Gq3E > span'
      );

      content.children().each((i, element) => {
        item.content?.push($(element).text());
      });

      updatedNews.push(item);
    }

    return updatedNews;
  }
}
