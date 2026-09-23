// Tipos parciais das respostas de https://brapi.dev/docs/fiis
// Só os campos usados por FundoFetcher.ts estão tipados explicitamente;
// o resto passa pelo index signature para não travar em mudanças da API.

export interface BrapiFiiIndicator {
  symbol: string
  name: string
  segmentType: 'papel' | 'tijolo' | 'hibrido' | 'fof' | string
  segmentoAtuacao: string | null
  mandate?: string | null
  administratorName?: string | null
  price: number | null
  navPerShare: number | null
  dividendYield12m: number | null
  [key: string]: unknown
}

export interface BrapiIndicatorsResponse {
  fiis: BrapiFiiIndicator[]
}

export interface BrapiListResponse {
  fiis: BrapiFiiIndicator[]
  pagination?: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
  }
}

export interface BrapiDividendEvent {
  symbol: string
  paymentDate: string | null
  exDate: string | null
  rate: number
  [key: string]: unknown
}

export interface BrapiDividendsResponse {
  dividends: BrapiDividendEvent[]
}

export interface BrapiPropertySummary {
  count: number
  totalArea: number
  vacancyRate: number
}

export interface BrapiPropertiesFii {
  symbol: string
  summary: BrapiPropertySummary
  [key: string]: unknown
}

export interface BrapiPropertiesResponse {
  fiis: BrapiPropertiesFii[]
}

export interface BrapiReport {
  symbol: string
  adminFeeRate: number | null
  [key: string]: unknown
}

export interface BrapiReportsResponse {
  reports: BrapiReport[]
}

export interface BrapiHistoricalCandle {
  date: number
  close: number
  volume: number
  [key: string]: unknown
}

export interface BrapiHistoricalFii {
  symbol: string
  historicalDataPrice: BrapiHistoricalCandle[]
}

export interface BrapiHistoricalResponse {
  fiis: BrapiHistoricalFii[]
}
