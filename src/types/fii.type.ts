/**
 * Item da busca avançada de FIIs do statusinvest
 * (`category/advancedsearchresultpaginated?CategoryType=2`)
 *
 * Percentuais vêm em % (8.93 = 8,93%). Campos ausentes significam que o
 * statusinvest não tem o dado do fundo
 */
export interface FiiListItem {
  companyid: number
  companyname: string
  ticker: string
  price: number
  /** Ex.: Fundo de Tijolo, Fundo de Papel, Fundo Misto */
  sectorname: string
  /** Ex.: Shoppings, Papéis, Fundo de Fundos */
  subsectorname: string
  segment: string
  /** Ativa, Passiva ou `-` */
  gestao_f: string
  dy: number
  p_vp?: number
  valorpatrimonialcota?: number
  liquidezmediadiaria?: number
  percentualcaixa?: number
  /** Crescimento anual composto dos dividendos em 3 anos (%) */
  dividend_cagr?: number
  /** Crescimento anual composto da cota em 3 anos (%) */
  cota_cagr?: number
  numerocotistas?: number
  numerocotas?: number
  patrimonio?: number
  lastdividend?: number
}

/** Resposta da busca avançada de FIIs */
export interface FiiListResponse {
  list: FiiListItem[]
  totalResults: number
}

/** Imóvel do portfólio de um FII */
export interface FiiProperty {
  nome: string
  uf: string | null
  /** m² */
  area: number | null
  /** % da área vaga */
  vacancia: number | null
}

/** Dados lidos da página do FII */
export interface FiiPageInfo {
  cnpj: string | null
  administradora: string | null
  /** `null` quando a página não tem a seção de portfólio */
  imoveis: FiiProperty[] | null
}

/** Pagamento de provento de um FII */
export interface FiiDividend {
  /** Data de pagamento (dd/mm/aaaa) */
  dataPagamento: string
  /** Rendimento, Amortização... */
  tipo: string
  /** R$ por cota */
  valor: number
}
