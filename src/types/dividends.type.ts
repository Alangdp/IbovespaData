export interface Helpers {
  earningsThisYearHelper: string
  earningsLastYearHelper: string
  earningsProvisionedHelper: string
  earningsMainTextHelper: string
}

export interface AssetEarningsModel {
  y: number
  m: number
  d: number
  ed: string
  pd: string
  et: string
  etd: string
  v: number
  /** Valor original, antes do ajuste por desdobramento (só quando `adj`) */
  ov?: number
  sv: string
  sov: string
  adj: boolean
}

export interface AssetEarningsYearlyModel {
  rank: number
  value: number
}

/** Resposta de `companytickerprovents` do statusinvest */
export interface RootDividend {
  earningsThisYear: string
  earningsLastYear: string
  rendiment: string
  rendimentIsUp: boolean
  provisionedThisYear: string
  rendimentWithProvisioned: string
  rendimentWithProvisionedIsUp: boolean
  helpers: Helpers
  assetEarningsModels: AssetEarningsModel[]
  assetEarningsYearlyModels: AssetEarningsYearlyModel[]
}

/** Um pagamento de provento */
export interface LastDividendPayment {
  ticker: string
  dataCom: string
  dataEx: string
  dividendType: string
  dividendTypeName: string
  value: number
}

/** Total de proventos pagos em um ano */
export interface LastDividendPaymentYear {
  year: number
  value: number
}

/** Proventos da ação, por pagamento e por ano */
export interface DividendReturn {
  lastDividendPayments: LastDividendPayment[]
  lastDividendPaymentsYear: LastDividendPaymentYear[]
  helper: Helpers
  dividendPaymentThisYear: number
  dividendPaymentLastYear: number
}
