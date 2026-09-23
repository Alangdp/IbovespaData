// Espelha o schema `Fundo` de fii-api.yaml (gerado do modelo Pydantic FundoFII).
// Os nomes dos campos são mantidos em snake_case DE PROPÓSITO: é o que o
// contrato exige na resposta JSON. Não renomear para camelCase.

export type Segmento = 'Tijolo' | 'Papel' | 'Híbrido' | 'FoF'

/* eslint-disable camelcase */
export interface FundoProps {
  ticker: string
  nome: string
  gestora: string | null
  segmento: Segmento
  subsegmento: string
  descricao: string
  cotacao: number | null
  valor_patrimonial_cota: number | null
  dividend_yield_12m: number | null
  dividendos_mensais: number[]
  taxa_administracao: number | null
  vacancia_fisica: number | null
  liquidez_diaria: number | null
  num_imoveis: number | null
  diversificado: boolean | null
  gestora_confiavel: boolean | null
  boa_localizacao: boolean | null
  limite_distribuicao_respeitado: boolean | null
  dividendo_extraordinario_ultimo_ano: boolean | null
  ltv_medio: number | null
  spread_credito: string | null
}
/* eslint-enable camelcase */
