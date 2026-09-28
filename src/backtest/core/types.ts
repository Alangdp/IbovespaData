/**
 * Tipos do módulo de backtest, independentes do tipo de ativo (FII, ação)
 *
 * Datas são sempre texto ISO `AAAA-MM-DD` (comparáveis como texto)
 */

/** Data ISO `AAAA-MM-DD` */
export type IsoDate = string

/** Frequência dos aportes */
export type FrequenciaAporte = 'diaria' | 'semanal' | 'mensal'

/** Frequência do rebalanceamento */
export type FrequenciaRebalanceamento =
  | 'nenhum'
  | 'mensal'
  | 'trimestral'
  | 'semestral'
  | 'anual'

/**
 * Como o valor do aporte é dividido entre os ativos selecionados
 * - `igual`: partes iguais
 * - `proporcional_score`: proporcional ao score
 * - `menor_peso`: prioriza os selecionados com menos peso na carteira
 */
export type Distribuicao = 'igual' | 'proporcional_score' | 'menor_peso'

/** Benchmark usado na comparação */
export type BenchmarkConfig =
  | { tipo: 'cdi' }
  | { tipo: 'ativo'; ticker: string }
  | { tipo: 'universo' }

/** Configuração de uma simulação */
export interface BacktestConfig {
  /** Nome livre, para identificar a simulação */
  nome?: string
  /** Primeira data da simulação; sem ela, usa `fim` menos `anos` */
  inicio?: IsoDate
  /** Última data da simulação; sem ela, usa a última data com cotação */
  fim?: IsoDate
  /** Tamanho do período em anos (5, 10, 15, 20), quando não há `inicio` */
  anos?: number
  /**
   * Valor aplicado no primeiro pregão, antes dos aportes periódicos (R$); é
   * investido na hora, seguindo a mesma seleção dos aportes
   */
  saldoInicial?: number
  /**
   * Cotas que a carteira já tem no início, avaliadas pelo fechamento do
   * primeiro pregão; o valor delas conta como aportado (o retorno mede só o
   * que acontece depois)
   */
  cotasIniciais?: { ticker: string; quantidade: number }[]
  aporte: {
    /** R$ por aporte (0 = sem aportes periódicos) */
    valor: number
    frequencia: FrequenciaAporte
    /**
     * Semanal: dia da semana (1 = segunda ... 5 = sexta); mensal: dia do mês
     * (1 a 31). Sem pregão no dia, usa o próximo pregão (no mensal, se o mês
     * acabar antes, o último pregão do mês)
     */
    dia?: number
  }
  selecao: {
    /** Quantidade de ativos comprados em cada aporte */
    quantidade: number
    /** Score mínimo para o ativo ser selecionado */
    scoreMinimo?: number
    /** Liquidez média diária mínima (R$) para o ativo entrar no universo */
    liquidezMinima?: number
    /**
     * Restringe o universo a estes tickers (ex.: `["GGRC11"]` para aportar só
     * nele), sem o filtro de liquidez (que continua valendo para o benchmark
     * universo); o score continua sendo calculado e registrado
     */
    tickers?: string[]
  }
  distribuicao: Distribuicao
  /** Soma os dividendos recebidos ao próximo aporte */
  reinvestirDividendos: boolean
  rebalanceamento: {
    frequencia: FrequenciaRebalanceamento
  }
  benchmark: BenchmarkConfig
  /** Versão do score (ver o registro de scorers de cada tipo de ativo) */
  score: string
  /** Permite comprar frações de cota (padrão: não) */
  fracionado?: boolean
  /** Alíquota de IR sobre o lucro nas vendas (padrão 0,2) */
  aliquotaIr?: number
  /** Custo de cada operação, fração do valor (padrão 0,0003) */
  custoOperacao?: number
  /** Horizontes (dias corridos) da análise após cada recomendação */
  horizontes?: number[]
}

/** Configuração com os padrões aplicados e o período resolvido */
export interface BacktestConfigResolvida
  extends Required<Omit<BacktestConfig, 'nome' | 'anos'>> {
  nome: string | null
  inicio: IsoDate
  fim: IsoDate
}

/** Valor de um critério usado no score, para registro */
export interface CriterioScore {
  criterio: string
  /** Valor apurado; `null` quando falta dado */
  valor: number | boolean | null
  /** Nota do critério (0 a 100); `null` quando falta dado */
  nota: number | null
  peso: number
}

/** Resultado do score de um ativo em uma data */
export interface ScoreResultado {
  /** 0 a 100 */
  score: number
  /** Parte do peso total com dado disponível (0 a 1) */
  cobertura: number
  criterios: CriterioScore[]
}

/** Ativo com score em uma data, já na ordem do ranking */
export interface ItemRanking {
  ativoId: string
  ticker: string
  score: number
  cobertura: number
  /** 1 = melhor */
  posicao: number
  /** Preço de fechamento do pregão anterior (base do score) */
  precoReferencia: number
  criterios: CriterioScore[]
}

/** Recomendação registrada em uma data de aporte */
export interface Recomendacao extends ItemRanking {
  data: IsoDate
  selecionado: boolean
  /** Preço da compra (fechamento do dia); `null` se não comprado */
  precoCompra: number | null
  quantidade: number
  valorInvestido: number
}

/** Tipo de operação na carteira */
export type TipoOperacao =
  | 'compra'
  | 'venda'
  | 'desdobramento'
  | 'grupamento'
  | 'encerramento'
  | 'posicao_inicial'

/** Operação registrada na carteira */
export interface Operacao {
  data: IsoDate
  ativoId: string
  ticker: string
  tipo: TipoOperacao
  /** Cotas (para desdobramento, a quantidade de cotas recebidas) */
  quantidade: number
  preco: number
  valor: number
  custo: number
  /** IR pago sobre o lucro da venda */
  ir: number
  /** Motivo (ex.: rebalanceamento, sem negociação) */
  motivo?: string
}

/** Dividendo recebido pela carteira */
export interface DividendoRecebido {
  dataCom: IsoDate
  dataPagamento: IsoDate
  ativoId: string
  ticker: string
  quantidade: number
  valorPorCota: number
  total: number
  /** Fonte do provento (ex.: statusinvest, cvm_estimado) */
  fonte: string
}

/** Situação da carteira ao fim de um pregão */
export interface PontoCarteira {
  data: IsoDate
  /** Total aportado até a data (R$) */
  aportado: number
  /** Valor de mercado das posições (R$) */
  posicoes: number
  /** Dinheiro parado (sobras e dividendos não reinvestidos) */
  caixa: number
  /** Patrimônio = posições + caixa */
  patrimonio: number
  /** Valor da cota da carteira (começa em 1), para retorno sem o efeito dos aportes */
  cota: number
  /** Patrimônio do benchmark com os mesmos aportes */
  benchmarkPatrimonio: number
  benchmarkCota: number
  /** CDI do dia (fração), para Sharpe e Sortino */
  cdiDia: number
}

/** Métricas de uma carteira (a da estratégia ou a do benchmark) */
export interface Metricas {
  aportado: number
  patrimonioFinal: number
  /** Patrimônio / aportado - 1 */
  retornoAcumulado: number
  /** Retorno da cota no período (sem o efeito dos aportes) */
  retornoCota: number
  /** Crescimento anual composto da cota */
  cagr: number | null
  /** Taxa interna de retorno anual dos fluxos (aportes e patrimônio final) */
  tir: number | null
  /** Maior queda da cota em relação ao pico anterior (fração negativa) */
  drawdownMaximo: number
  /** Volatilidade anualizada dos retornos diários da cota */
  volatilidade: number | null
  sharpe: number | null
  sortino: number | null
}

/** Resultado consolidado da simulação */
export interface ResumoSimulacao {
  estrategia: Metricas & {
    /** Ganho de preço, realizado e não realizado (R$) */
    valorizacao: number
    dividendosRecebidos: number
    dividendosReinvestidos: number
    irPago: number
    custos: number
  }
  benchmark: Metricas
  /** CAGR da estratégia menos o do benchmark */
  excessoCagr: number | null
  /** Patrimônio final da estratégia menos o do benchmark (R$) */
  excessoPatrimonio: number
}

/** Evento de um ativo (desdobramento, encerramento; no futuro, notícias) */
export interface EventoAtivo {
  ativoId: string
  data: IsoDate
  tipo: string
  /** Fator do desdobramento (cotas novas por cota antiga) */
  fator?: number
  descricao?: string
  fonte: string
}
