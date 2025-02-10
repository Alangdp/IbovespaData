/* eslint-disable no-constant-condition */
/* eslint-disable prettier/prettier */
import { MacroInfo } from '@/global/MacroInfo'

interface PortfolioData {
  ticker: string
  name: string
  quantity: number
  averagePrice: number
  currentValue: number
  currentValueInDolar: number
  totalInvested: number
  currency: 'BRL' | 'USD'
}

interface StockPortfolio extends PortfolioData {}

interface FiiPortfolio extends PortfolioData {
  dyPercent: number
  dyInLastMonth: number
}

interface CryptoPortfolio extends PortfolioData {}

class Chart {
  private cdiValue!: number
  private bitcoinValue!: number
  private dolarValue!: number

  public StockPortfolio: StockPortfolio[] = []
  public FiiPortfolio: FiiPortfolio[] = []
  public CryptoPortfolio: CryptoPortfolio[] = []

  public totalInvested: number = 0
  public totalCurrentValue: number = 0

  async convertBalance(toConvert: PortfolioData) {
    if (toConvert.currency === 'USD') {
      toConvert.currentValueInDolar =
        toConvert.quantity * toConvert.currentValue
      toConvert.currentValue = toConvert.currentValueInDolar * this.dolarValue
      toConvert.totalInvested =
        toConvert.quantity * toConvert.averagePrice * this.dolarValue
    }

    if (toConvert.currency === 'BRL') {
      toConvert.currentValue = toConvert.quantity * toConvert.currentValue
      toConvert.currentValueInDolar = toConvert.currentValue / this.dolarValue
      toConvert.totalInvested = toConvert.quantity * toConvert.averagePrice
    }

    this.totalInvested += toConvert.totalInvested
    this.totalCurrentValue += toConvert.currentValue
  }

  async getMacros() {
    const cdiRoot = await MacroInfo.getCDI()
    const dolarValue = await MacroInfo.getDolar()

    this.cdiValue =
      cdiRoot.value
        .slice(Math.max(cdiRoot.value.length - 12, 1))
        .reduce((acc, curr) => acc + curr.VALVALOR, 0) / 12
    this.bitcoinValue = await MacroInfo.getBitcoin()

    this.dolarValue = dolarValue?.cotacaoVenda ?? 0
  }

  async getPortfolioData() {
    const stocks = this.StockPortfolio
    const fiis = this.FiiPortfolio
    const cryptos = this.CryptoPortfolio

    this.StockPortfolio = stocks.map((stock) => {
      this.convertBalance(stock)

      return {
        ...stock,
      }
    })

    this.FiiPortfolio = fiis.map((fii) => {
      this.convertBalance(fii)

      const dyInLastMonth = fii.dyPercent / 100 / 12
      const dyInLastMonthValue = dyInLastMonth * fii.currentValue

      return {
        ...fii,
        dyInLastMonth: dyInLastMonthValue,
      }
    })

    this.CryptoPortfolio = cryptos.map((crypto) => {
      this.convertBalance(crypto)

      return {
        ...crypto,
      }
    })

    console.log(this.StockPortfolio)
    console.log(this.FiiPortfolio)
    console.log(this.CryptoPortfolio)
  }
}

async function t() {
  const chart = new Chart()
  await chart.getMacros()

  chart.StockPortfolio = [
    {
      ticker: 'TAEE11',
      name: 'TAESA',
      quantity: 27,
      averagePrice: 36.9,
      currentValue: 32.89,
      totalInvested: 0,
      currentValueInDolar: 0,
      currency: 'BRL',
    },
  ]

  chart.FiiPortfolio = [
    {
      ticker: 'MXRF11',
      name: 'Maxi Renda',
      currentValue: 8.99,
      averagePrice: 9.03,
      quantity: 20,
      dyPercent: 0,
      totalInvested: 0,
      dyInLastMonth: 0,
      currentValueInDolar: 0,
      currency: 'BRL',
    },
    {
      ticker: 'VGHF11',
      name: 'Valora Hedge',
      currentValue: 6.97,
      averagePrice: 7.47,
      quantity: 31,
      dyInLastMonth: 0,
      dyPercent: 0,
      totalInvested: 0,
      currentValueInDolar: 0,
      currency: 'BRL',
    },
    {
      ticker: 'VGHF12',
      name: 'Valora Hedge',
      currentValue: 10,
      averagePrice: 7.47,
      quantity: 10,
      dyInLastMonth: 0,
      dyPercent: 0,
      totalInvested: 0,
      currentValueInDolar: 0,
      currency: 'USD',
    },
  ]
  chart.getPortfolioData()

  console.log('Valor Investido: ', chart.totalInvested)
  console.log('Valor Atual: ', chart.totalCurrentValue)
}
t()

// RENDA FIXA CDI - RDB NUBANK - 100% CDI
// Valor investido: R$ 1.284,09
