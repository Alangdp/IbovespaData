import axios from 'axios';
import { Stock } from '../Entities/Stock.js';
import TickerFetcher from '../useCases/Fetcher.js';

export interface RootCDI {
  '@odata.context': string;
  value: Value[];
}

export interface RootIPCA {
  '@odata.context': string;
  value: Value[];
}

export interface Value {
  SERCODIGO: string;
  VALDATA: string;
  VALVALOR: number;
  NIVNOME: string;
  TERCODIGO: string;
}

// TODO - ATUALIZAR
export class MacroInfo {
  static firstStart: boolean = true;
  static readonly version: string = '1.0.0';
  static CDI: number;
  static IPCA: number;
  static tickers: string[];
  static stocks: Stock[] = [];

  static async getCDI() {
    const response = await axios.get(
      "http://ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='PAN12_TJOVER12')"
    );
    const data: RootCDI = response.data;
    return Number(data.value[data.value.length - 1].VALVALOR.toFixed(2));
  }

  static async getIPCA() {
    const response = await axios.get(
      "http://ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='PAN12_IPCAG12')"
    );
    const data: RootIPCA = response.data;
    return Number(data.value[data.value.length - 1].VALVALOR.toFixed(2));
  }

  static async initialize() {
    if (!MacroInfo.firstStart) return;
    MacroInfo.firstStart = false;

    this.getCDI().then((result) => {
      this.CDI = result;
    });

    this.getIPCA().then((result) => {
      this.CDI = result;
    });

    this.tickers = await TickerFetcher.getAllTickers();

    return await TickerFetcher.getAllTickers();
  }
}
