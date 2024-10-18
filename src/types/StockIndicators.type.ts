export interface Indicators {
  p_l: number; // P/L
  payout: number; // PAYOUT
  ev_ebitda: number; // EV/EBITDA
  ev_ebit: number; // EV/EBIT
  p_ebita: number; // P/EBITDA
  p_ebit: number; // P/EBIT
  dividendYield: number; // DY
  p_ativo: number; // P/ATIVO
  p_sr: number; // P/SR
  p_capitlgiro: number; // P/CAP.GIRO
  p_ativocirculante: number; // P/ATIVO CIRC.LIQ
  margemebitda: number; // MARGEM EBITDA
  margemebit: number; // MARGEM EBIT
  margembruta: number; // MARGEM BRUTA
  margemliquida: number; // MARGEM LIQUIDA
  dividaliquida_patrimonioliquido: number; // DIV.LIQUIDA/PL
  dividaliquida_ebitda: number; // DIV.LIQUIDA/EBITDA
  dividaliquida_ebit: number; // DIV.LIQUIDA/EBIT
  patrimonio_ativo: number; // PL/ATIVOS
  passivo_ativo: number; // PASSIVOS/ATIVOS
  liquidezcorrente: number; // LIQ.CORRENTE
  roe: number; // ROE
  roa: number; // ROA
  roic: number; // ROIC
  giro_ativos: number; // GIRO ATIVOS
  receitas_cagr5: number; // CAGR RECEITA 5 ANOS
  lucros_cagr5: number; // CAGR LUCRO 5 ANOS
}
