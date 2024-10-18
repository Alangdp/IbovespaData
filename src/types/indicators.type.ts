export interface OldData {
  date: number;
  value: number;
}

export interface FinancialData {
  actual: number;
  avg: number;
  olds: OldData[];
}

export interface FinancialIndicators {
  dy: FinancialData;
  p_l: FinancialData;
  p_vp: FinancialData;
  p_ebita: FinancialData;
  p_ebit: FinancialData;
  p_sr: FinancialData;
  p_ativo: FinancialData;
  p_capitlgiro: FinancialData;
  p_ativocirculante: FinancialData;
  ev_ebitda: FinancialData;
  ev_ebit: FinancialData;
  lpa: FinancialData;
  vpa: FinancialData;
  peg_Ratio: FinancialData;
  dividaliquida_patrimonioliquido: FinancialData;
  dividaliquida_ebitda: FinancialData;
  dividaliquida_ebit: FinancialData;
  patrimonio_ativo: FinancialData;
  passivo_ativo: FinancialData;
  liquidezcorrente: FinancialData;
  margembruta: FinancialData;
  margemebitda: FinancialData;
  margemebit: FinancialData;
  margemliquida: FinancialData;
  roe: FinancialData;
  roa: FinancialData;
  roic: FinancialData;
  giro_ativos: FinancialData;
  receitas_cagr5: FinancialData;
}

export interface IndicatorRoot {
  success: boolean
  data: Data
}

export interface Data {
  [ticker: string]: IndicatorResponse[]
}

export interface IndicatorResponse {
  key: string
  actual: number
  avg: number
  avgDifference: number
  minValue: number
  minValueRank: number
  maxValue: number
  maxValueRank: number
  actual_F: string
  avg_F: string
  avgDifference_F?: string
  minValue_F: string
  minValueRank_F: string
  maxValue_F: string
  maxValueRank_F: string
  ranks: Rank[]
}

export interface Rank {
  timeType: number
  rank: number
  rank_F: string
  value?: number
  value_F: string
  rankN: number
}

export interface IndicatorsData {
  [key: string] : {
    actual: number,
    avg: number
    olds: oldIndicator[]
  }
}

export interface oldIndicator {
  date: number;
  value?: number;
}