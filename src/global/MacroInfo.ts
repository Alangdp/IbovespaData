import axios from 'axios'

import { Stock } from '../entities/Stock.js'
import TickerFetcher from '../useCases/Fetcher.js'

export interface Value {
  SERCODIGO: string
  VALDATA: string
  VALVALOR: number
  NIVNOME: string
  TERCODIGO: string
}

type CDIToMap = {
  date: Date
  valMonth: number
  valDay: number
}
export interface DolarValue {
  cotacaoCompra: number
  cotacaoVenda: number
  dataHoraCotacao: string
}

export interface RootDolar {
  '@odata.context': string
  value: DolarValue[]
}

export interface RootSelic {
  '@odata.context': string
  value: Value[]
}

export interface RootIPCA {
  '@odata.context': string
  value: Value[]
}

export interface RootCDI {
  '@odata.context': string
  value: Value[]
}

// TODO - ATUALIZAR
export class MacroInfo {
  static firstStart: boolean = true
  static readonly version: string = '1.0.0'
  static SELIC: number
  static CDI: number
  static IPCA: number
  static tickers: string[]
  static stocks: Stock[] = []

  static async getSELIC() {
    const response = await axios.get(
      "http://ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='PAN12_TJOVER12')",
    )
    const data: RootCDI = response.data
    return Number(data.value[data.value.length - 1].VALVALOR.toFixed(2))
  }

  static async getDolar() {
    const response = await axios.get(
      "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='02-10-2025'&$top=100&$format=json",
    )
    const data: RootDolar = response.data
    if (data.value.length === 0) return
    return data.value[0]
  }

  static async getCDI() {
    const response = await axios.get(
      "http://ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='BM12_TJCDI12')",
    )
    const data: RootCDI = response.data
    return data
  }

  // Retornar como:
  // {
  //   date: Date,
  //   valMonth: number,
  //   valDay: number
  // }
  static async GetCDIToMap() {
    const CDIData = await MacroInfo.getCDI()
    const data: CDIToMap[] = []

    for (const dataIndex of CDIData.value) {
      const date = new Date(dataIndex.VALDATA)
      date.setHours(0)
      date.setMinutes(0)
      date.setSeconds(0)
      date.setMilliseconds(0)

      const dayOnTheMonth = new Date(
        date.getFullYear(),
        date.getMonth(),
        0,
      ).getDate()

      data.push({
        date,
        valMonth: Number(dataIndex.VALVALOR),
        valDay: Number(dataIndex.VALVALOR) / dayOnTheMonth,
      })
    }
  }

  static async getIPCA() {
    const response = await axios.get(
      "http://ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='PAN12_IPCAG12')",
    )
    const data: RootIPCA = response.data
    return Number(data.value[data.value.length - 1].VALVALOR.toFixed(2))
  }

  static async initialize() {
    if (!MacroInfo.firstStart) return
    MacroInfo.firstStart = false

    this.getSELIC().then((result) => {
      this.SELIC = result
    })

    this.getCDI().then((result) => {
      this.SELIC = Number(
        result.value[result.value.length - 1].VALVALOR.toFixed(2),
      )
    })

    this.getIPCA().then((result) => {
      this.IPCA = result
    })

    this.tickers = await TickerFetcher.getAllTickers()

    return await TickerFetcher.getAllTickers()
  }
}
