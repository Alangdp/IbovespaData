import { FundoProps, Segmento } from '../types/fundo.types.js'

/* eslint-disable camelcase */
// Campos em snake_case de propósito — ver types/fundo.types.ts
export class Fundo implements FundoProps {
  public ticker: string
  public nome: string
  public gestora: string | null
  public segmento: Segmento
  public subsegmento: string
  public descricao: string
  public cotacao: number | null
  public valor_patrimonial_cota: number | null
  public dividend_yield_12m: number | null
  public dividendos_mensais: number[]
  public taxa_administracao: number | null
  public vacancia_fisica: number | null
  public liquidez_diaria: number | null
  public num_imoveis: number | null
  public diversificado: boolean | null
  public gestora_confiavel: boolean | null
  public boa_localizacao: boolean | null
  public limite_distribuicao_respeitado: boolean | null
  public dividendo_extraordinario_ultimo_ano: boolean | null
  public ltv_medio: number | null
  public spread_credito: string | null

  constructor(props: FundoProps) {
    this.ticker = props.ticker
    this.nome = props.nome
    this.gestora = props.gestora
    this.segmento = props.segmento
    this.subsegmento = props.subsegmento
    this.descricao = props.descricao
    this.cotacao = props.cotacao
    this.valor_patrimonial_cota = props.valor_patrimonial_cota
    this.dividend_yield_12m = props.dividend_yield_12m
    this.dividendos_mensais = props.dividendos_mensais
    this.taxa_administracao = props.taxa_administracao
    this.vacancia_fisica = props.vacancia_fisica
    this.liquidez_diaria = props.liquidez_diaria
    this.num_imoveis = props.num_imoveis
    this.diversificado = props.diversificado
    this.gestora_confiavel = props.gestora_confiavel
    this.boa_localizacao = props.boa_localizacao
    this.limite_distribuicao_respeitado = props.limite_distribuicao_respeitado
    this.dividendo_extraordinario_ultimo_ano =
      props.dividendo_extraordinario_ultimo_ano
    this.ltv_medio = props.ltv_medio
    this.spread_credito = props.spread_credito
  }
}
/* eslint-enable camelcase */
