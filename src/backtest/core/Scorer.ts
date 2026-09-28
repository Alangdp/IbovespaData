import type { AtivoSnapshot } from './HistoricalDataProvider.js'
import type { CriterioScore, ItemRanking, ScoreResultado } from './types.js'

/**
 * Faixa de um critério numérico: pontos (valor, nota) em ordem crescente de
 * valor; entre dois pontos a nota é interpolada e fora deles vale a nota da
 * ponta (ex.: `[[0.85, 100], [1, 60], [1.2, 0]]` para P/VP)
 */
export type Faixa = [valor: number, nota: number][]

/** Critério de um score: como extrair o valor do snapshot e dar a nota */
export interface CriterioConfig<TSnapshot> {
  criterio: string
  peso: number
  /** Valor apurado; `null` quando falta dado */
  valor: (snapshot: TSnapshot) => number | boolean | null
  /** Faixa do valor numérico; critério booleano vale 100 (true) ou 0 (false) */
  faixa?: Faixa
}

/** Versão de um score: critérios, pesos e faixas */
export interface ScoreConfig<TSnapshot> {
  versao: string
  descricao: string
  /** Parte mínima do peso total com dado para o ativo ter score (0 a 1) */
  coberturaMinima: number
  criterios: CriterioConfig<TSnapshot>[]
}

/** Calcula a nota do valor pela faixa, interpolando entre os pontos */
export function notaDaFaixa(valor: number, faixa: Faixa): number {
  // Se o valor está antes do primeiro ponto
  if (valor <= faixa[0][0]) {
    return faixa[0][1]
  }
  for (let i = 1; i < faixa.length; i++) {
    const [x1, y1] = faixa[i]
    // Se o valor está entre o ponto anterior e este
    if (valor <= x1) {
      const [x0, y0] = faixa[i - 1]
      return y0 + ((valor - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return faixa[faixa.length - 1][1]
}

/**
 * Pontuação de ativos em uma data
 *
 * A base calcula o score como a média ponderada das notas dos critérios com
 * dado (falta de dado não puxa o score para baixo, mas abaixo da cobertura
 * mínima o ativo fica sem score) e monta o ranking. Cada tipo de ativo
 * estende a classe com os seus critérios; um tipo com regra diferente pode
 * sobrescrever `avaliar`
 */
export abstract class Scorer<TSnapshot extends AtivoSnapshot> {
  constructor(protected readonly config: ScoreConfig<TSnapshot>) {}

  /** Identificador da versão, gravado com os resultados */
  get versao(): string {
    return this.config.versao
  }

  get descricao(): string {
    return this.config.descricao
  }

  /** Critérios que a versão usa, com peso e faixa (sem as funções) */
  get criteriosConfig(): { criterio: string; peso: number; faixa?: Faixa }[] {
    return this.config.criterios.map(({ criterio, peso, faixa }) => ({
      criterio,
      peso,
      ...(faixa ? { faixa } : {}),
    }))
  }

  /** Cobertura mínima da versão (0 a 1) */
  get coberturaMinima(): number {
    return this.config.coberturaMinima
  }

  /**
   * Calcula a nota de cada critério, mesmo quando a cobertura não basta
   * para o score (usado para explicar o resultado)
   */
  criterios(snapshot: TSnapshot): CriterioScore[] {
    return this.config.criterios.map((config) => {
      const valor = config.valor(snapshot)
      let nota: number | null = null
      // Se há dado para o critério
      if (typeof valor === 'boolean') {
        nota = valor ? 100 : 0
      } else if (valor !== null && Number.isFinite(valor) && config.faixa) {
        nota = notaDaFaixa(valor, config.faixa)
      }
      return { criterio: config.criterio, valor, nota, peso: config.peso }
    })
  }

  /**
   * Calcula o score do ativo
   *
   * @returns `null` se a cobertura dos critérios ficou abaixo do mínimo
   */
  avaliar(snapshot: TSnapshot): ScoreResultado | null {
    const criterios = this.criterios(snapshot)

    // Soma o peso total e o peso dos critérios com nota
    const pesoTotal = criterios.reduce((sum, c) => sum + c.peso, 0)
    const avaliados = criterios.filter((c) => c.nota !== null)
    const pesoAvaliado = avaliados.reduce((sum, c) => sum + c.peso, 0)
    const cobertura = pesoTotal > 0 ? pesoAvaliado / pesoTotal : 0
    // Se falta dado demais para o score valer
    if (pesoAvaliado === 0 || cobertura < this.config.coberturaMinima) {
      return null
    }

    const soma = avaliados.reduce((sum, c) => sum + (c.nota ?? 0) * c.peso, 0)
    return {
      score: Math.round((soma / pesoAvaliado) * 100) / 100,
      cobertura: Math.round(cobertura * 1000) / 1000,
      criterios,
    }
  }

  /**
   * Monta o ranking: ativos com score, do maior para o menor (empate: maior
   * liquidez primeiro, depois o ticker)
   */
  ranking(snapshots: TSnapshot[]): ItemRanking[] {
    return snapshots
      .map((snapshot) => ({ snapshot, resultado: this.avaliar(snapshot) }))
      .filter(
        (item): item is { snapshot: TSnapshot; resultado: ScoreResultado } =>
          item.resultado !== null,
      )
      .sort(
        (a, b) =>
          b.resultado.score - a.resultado.score ||
          b.snapshot.liquidezMedia - a.snapshot.liquidezMedia ||
          a.snapshot.ticker.localeCompare(b.snapshot.ticker),
      )
      .map(({ snapshot, resultado }, index) => ({
        ativoId: snapshot.ativoId,
        ticker: snapshot.ticker,
        score: resultado.score,
        cobertura: resultado.cobertura,
        posicao: index + 1,
        precoReferencia: snapshot.preco,
        criterios: resultado.criterios,
      }))
  }
}
