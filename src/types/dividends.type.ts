export interface RootDividend {
  earningsThisYear: string;
  earningsLastYear: string;
  rendiment: string;
  rendimentIsUp: boolean;
  provisionedThisYear: string;
  rendimentWithProvisioned: string;
  rendimentWithProvisionedIsUp: boolean;
  helpers: Helpers;
  assetEarningsModels: AssetEarningsModel[];
  assetEarningsYearlyModels: AssetEarningsYearlyModel[];
}

export interface Helpers {
  earningsThisYearHelper: string;
  earningsLastYearHelper: string;
  earningsProvisionedHelper: string;
  earningsMainTextHelper: string;
}

export interface AssetEarningsModel {
  y: number;
  m: number;
  d: number;
  ed: string;
  pd: string;
  et: string;
  etd: string;
  v: number;
  sv: string;
  sov: string;
  adj: boolean;
}

export interface AssetEarningsYearlyModel {
  rank: number;
  value: number;
}

export interface DividendReturn {
  lastDividendPayments: LastDividendPayment[];
  lastDividendPaymentsYear: LastDividendPaymentYear[];
  helper: Helpers;
  dividendPaymentThisYear: number;
  dividendPaymentLastYear: number;
}

export interface LastDividendPayment {
  ticker: string;
  dataCom: string;
  dataEx: string;
  dividendType: string;
  dividendTypeName: string;
  value: number;
}

export interface LastDividendPaymentYear {
  year: number;
  value: number;
}

export type Dividends = {
  [ticker: string]: Dividend[];
};

export type Dividend = {
  date: string;
  ticker: string;
  value: number;
  type: string;
};

export interface DividendOnDate {
  [ticker: string]: Dividend;
}
