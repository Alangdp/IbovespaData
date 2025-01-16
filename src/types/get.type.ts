type Header = {
  name: string
  index: number
  value: { [key: string]: number }
}

interface Dividend {
  type: string
  dataEx: string
  dataCom: string
  value: number
}

interface Dividends {
  lastDividends: Dividend[]
  dividiendPorcentInDecimal: number
  dividendPorcent: number
}

export { Dividends, Dividend, Header }
