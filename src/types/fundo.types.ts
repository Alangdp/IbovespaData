/** Segmentos de FII aceitos pelo contrato */
export type Segmento = 'Tijolo' | 'Papel' | 'Híbrido' | 'FoF'

/**
 * Fundo imobiliário, como devolvido pelas rotas `/fundos`
 *
 * Espelha o schema `Fundo` de fii-api.yaml (gerado do modelo Pydantic
 * FundoFII). Os campos ficam em snake_case DE PROPÓSITO: é o que o contrato
 * exige na resposta JSON. Não renomear para camelCase
 */
export interface Fundo {
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

  // Campos extras, fora do contrato original (documentados no openapi.yaml)

  /** Administradora do fundo */
  administradora: string | null
  /** CNPJ da gestora (só dígitos), do informe anual da CVM */
  gestora_cnpj: string | null
  /** Rendimentos declarados / resultado financeiro do último semestre (%) */
  percentual_distribuido: number | null
  /** Obrigações por securitização e por aquisição de imóveis / ativo (%) */
  alavancagem: number | null
  /** Data de referência do relatório gerencial de onde saiu o `ltv_medio` */
  ltv_referencia: string | null
  /** Só dígitos */
  cnpj: string | null
  /** Tipo de gestão (Ativa, Passiva) */
  tipo_gestao: string | null
  /** Cotação / valor patrimonial por cota */
  p_vp: number | null
  /** Último rendimento / cotação (%) */
  dividend_yield_1m: number | null
  /** Último rendimento pago (R$ por cota) */
  ultimo_rendimento: number | null
  /** Crescimento anual composto dos dividendos em 3 anos (%) */
  dividend_cagr_3a: number | null
  /** Crescimento anual composto da cota em 3 anos (%) */
  cota_cagr_3a: number | null
  /** % do patrimônio em caixa */
  percentual_caixa: number | null
  numero_cotistas: number | null
  cotas_emitidas: number | null
  /** R$ */
  patrimonio_liquido: number | null
  /** Cotação * cotas emitidas (R$) */
  valor_mercado: number | null
  /** m² somados dos imóveis */
  area_total: number | null
}
