import { retornoEntre } from './analysis.js'
import type {
  AtivoSnapshot,
  HistoricalDataProvider,
} from './HistoricalDataProvider.js'
import type { BenchmarkConfig, IsoDate } from './types.js'

type Provider = HistoricalDataProvider<AtivoSnapshot>

/** Variação no mês acima da qual o retorno de um ativo é tratado como erro de dado */
const RETORNO_MENSAL_MAXIMO = 1

/**
 * Referência de comparação da estratégia
 *
 * Cada benchmark é um índice de retorno total nos pregões da simulação; os
 * aportes compram "cotas" do índice, então o benchmark recebe exatamente os
 * mesmos fluxos que a carteira
 */
export abstract class Benchmark {
  /** Nome exibido nos resultados */
  abstract readonly nome: string

  constructor(protected readonly provider: Provider) {}

  /**
   * Calcula o índice em cada pregão (o primeiro vale 1)
   *
   * @param pregoes - Pregões da simulação, em ordem
   */
  abstract indice(pregoes: IsoDate[]): number[]

  /**
   * Instancia o benchmark da configuração
   *
   * @param liquidezMinima - Filtro de liquidez da estratégia (usado no universo)
   */
  static criar(
    config: BenchmarkConfig,
    provider: Provider,
    liquidezMinima = 0,
  ): Benchmark {
    switch (config.tipo) {
      case 'cdi':
        return new CdiBenchmark(provider)
      case 'ativo':
        return new AtivoBenchmark(provider, config.ticker)
      case 'universo':
        return new UniversoBenchmark(provider, liquidezMinima)
    }
  }

  /**
   * Retorno total de um dia para o ativo: variação do preço (ajustada por
   * desdobramento) mais os proventos que ficaram ex no dia
   *
   * @returns `null` se o ativo não negociou nos dois pregões
   */
  protected retornoDia(
    ativoId: string,
    anterior: IsoDate,
    atual: IsoDate,
  ): number | null {
    const precoAnterior = this.provider.precoNoDia(ativoId, anterior)
    const precoAtual = this.provider.precoNoDia(ativoId, atual)
    // Se falta cotação em um dos pregões
    if (!precoAnterior || !precoAtual) {
      return null
    }

    // Soma os proventos com data-com no pregão anterior (ou entre os dois)
    const proventos = this.provider
      .proventos(ativoId)
      .filter(
        (provento) => provento.dataCom >= anterior && provento.dataCom < atual,
      )
      .reduce((sum, provento) => sum + provento.valor, 0)
    const fator = this.provider.fatorEntre(ativoId, anterior, atual)
    return (precoAtual * fator + proventos) / precoAnterior - 1
  }
}

/** CDI acumulado */
export class CdiBenchmark extends Benchmark {
  readonly nome = 'CDI'

  indice(pregoes: IsoDate[]): number[] {
    const cdi = this.provider.cdi()
    const valores: number[] = []
    let valor = 1
    for (let i = 0; i < pregoes.length; i++) {
      // Aplica a taxa do dia a partir do segundo pregão
      if (i > 0) {
        valor *= 1 + (cdi.get(pregoes[i]) ?? 0)
      }
      valores.push(valor)
    }
    return valores
  }
}

/** Um ativo com os proventos reinvestidos (ex.: XFIX11, um FII) */
export class AtivoBenchmark extends Benchmark {
  readonly nome: string

  constructor(
    provider: Provider,
    private readonly ticker: string,
  ) {
    super(provider)
    this.nome = ticker.toUpperCase()
  }

  indice(pregoes: IsoDate[]): number[] {
    const ativo = this.provider
      .ativos()
      .find((item) => item.ticker === this.ticker.toUpperCase())
    // Se o ativo não está na base
    if (!ativo) {
      throw new Error(`benchmark sem cotação na base: ${this.ticker}`)
    }

    // Acumula o retorno total, parado nos dias sem negociação
    const valores: number[] = []
    let valor = 1
    let anterior: IsoDate | null = null
    for (const pregao of pregoes) {
      // Se o ativo negociou no dia, acumula o retorno desde o último negócio
      if (this.provider.precoNoDia(ativo.ativoId, pregao)) {
        const retorno = anterior
          ? this.retornoDia(ativo.ativoId, anterior, pregao)
          : null
        valor *= 1 + (retorno ?? 0)
        anterior = pregao
      }
      valores.push(valor)
    }
    return valores
  }
}

/**
 * Média igual dos ativos do universo com a liquidez mínima, uma referência do
 * "mercado" do tipo de ativo
 *
 * A carteira é montada no fechamento do último pregão de cada mês com os
 * ativos negociáveis no primeiro pregão do mês seguinte (mesmo filtro de
 * liquidez da estratégia, só com dados até aquele fechamento) e mantida até o
 * mês seguinte. Rebalancear todo dia inflaria o retorno com a oscilação entre
 * compra e venda dos ativos pouco negociados
 */
export class UniversoBenchmark extends Benchmark {
  readonly nome: string

  constructor(
    provider: Provider,
    private readonly liquidezMinima = 0,
  ) {
    super(provider)
    this.nome =
      liquidezMinima > 0
        ? `Universo (média igual, liquidez >= ${liquidezMinima})`
        : 'Universo (média igual)'
  }

  indice(pregoes: IsoDate[]): number[] {
    const valores: number[] = []
    let base = 1
    /** Pregão de partida da carteira do mês */
    let partida: IsoDate | null = null
    let mes = ''
    let membros: { ativoId: string; preco: number }[] = []

    for (let i = 0; i < pregoes.length; i++) {
      const pregao = pregoes[i]
      // Se começou um mês, fecha o anterior e monta a carteira nova, que parte
      // do fechamento do pregão anterior (no primeiro mês, do próprio pregão)
      if (pregao.slice(0, 7) !== mes) {
        mes = pregao.slice(0, 7)
        base = valores.at(-1) ?? 1
        const inicial = i === 0
        partida = inicial ? pregao : pregoes[i - 1]
        membros = this.provider
          .universo(pregao)
          .filter((snapshot) => snapshot.liquidezMedia >= this.liquidezMinima)
          .map((snapshot) => ({
            ativoId: snapshot.ativoId,
            preco: inicial
              ? (this.provider.precoNoDia(snapshot.ativoId, pregao) ??
                snapshot.preco)
              : snapshot.preco,
          }))
      }

      // Calcula o retorno médio dos membros desde a partida (o provento com
      // data-com na partida já entrou no mês anterior)
      let soma = 0
      let quantidade = 0
      for (const membro of membros) {
        const retorno = retornoEntre(
          this.provider,
          membro.ativoId,
          partida ?? pregao,
          membro.preco,
          pregao,
          null,
          i > 0 && partida !== pregao,
        )
        const total = retorno?.retornoTotal ?? 0
        // Se o retorno é um erro de dado evidente
        if (Math.abs(total) >= RETORNO_MENSAL_MAXIMO) {
          continue
        }
        soma += total
        quantidade++
      }
      valores.push(base * (1 + (quantidade > 0 ? soma / quantidade : 0)))
    }

    // Normaliza para o primeiro pregão valer 1
    const primeiro = valores[0] ?? 1
    return valores.map((valor) => valor / primeiro)
  }
}
