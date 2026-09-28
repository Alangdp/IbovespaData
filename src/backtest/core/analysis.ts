import { addDays } from './dates.js'
import type {
  AtivoSnapshot,
  HistoricalDataProvider,
} from './HistoricalDataProvider.js'
import type { IsoDate } from './types.js'

type Provider = HistoricalDataProvider<AtivoSnapshot>

/** Horizontes padrão da análise (dias corridos) */
export const HORIZONTES_PADRAO = [30, 90, 180, 365, 730, 1825]

/** O que aconteceu com o ativo depois da recomendação, em um horizonte */
export interface RetornoFuturo {
  /** Dias corridos; `null` = até o fim da simulação */
  horizonte: number | null
  /** Último pregão considerado */
  dataFinal: IsoDate
  /** Preço final na base de cotas da recomendação (ajustado por desdobramento) */
  precoFinal: number
  /** Proventos por cota recebidos no período (base da recomendação) */
  dividendosPorCota: number
  retornoPreco: number
  retornoDividendos: number
  retornoTotal: number
  /**
   * `false` se o ativo parou de ser negociado antes do fim do horizonte (o
   * retorno usa o último preço)
   */
  completo: boolean
}

/**
 * Calcula o retorno do ativo de uma data até outra: variação do preço e
 * proventos (sem reinvestir) com data-com no período, tudo na base de cotas
 * da data inicial
 *
 * A compra no fechamento da data-com ainda dá direito ao provento, então a
 * data-com da própria data inicial conta
 *
 * @param precoBase - Preço de compra na data inicial
 * @param excluirDataInicial - Não conta o provento com data-com na data
 * inicial (quem mediu o período anterior até essa data já contou)
 * @returns `null` se o ativo não tem cotação depois da data inicial
 */
export function retornoEntre(
  provider: Provider,
  ativoId: string,
  data: IsoDate,
  precoBase: number,
  dataFim: IsoDate,
  horizonte: number | null,
  excluirDataInicial = false,
): RetornoFuturo | null {
  const final = provider.ultimoPrecoAte(ativoId, dataFim)
  // Se não há cotação ou ela é de antes da recomendação
  if (!final || final.data < data || precoBase <= 0) {
    return null
  }

  // Soma os proventos do período, convertidos para a base de cotas inicial
  let dividendosPorCota = 0
  for (const provento of provider.proventos(ativoId)) {
    const depoisDoInicio = excluirDataInicial
      ? provento.dataCom > data
      : provento.dataCom >= data
    if (depoisDoInicio && provento.dataCom <= final.data) {
      dividendosPorCota +=
        provento.valor * provider.fatorEntre(ativoId, data, provento.dataCom)
    }
  }

  // Converte o preço final para a base de cotas inicial
  const precoFinal =
    final.fechamento * provider.fatorEntre(ativoId, data, final.data)
  const retornoPreco = precoFinal / precoBase - 1
  const retornoDividendos = dividendosPorCota / precoBase
  const ativo = provider.ativo(ativoId)
  return {
    horizonte,
    dataFinal: final.data,
    precoFinal,
    dividendosPorCota,
    retornoPreco,
    retornoDividendos,
    retornoTotal: retornoPreco + retornoDividendos,
    completo: !ativo || ativo.ultimaData >= dataFim,
  }
}

/**
 * Calcula o retorno depois da recomendação em cada horizonte
 *
 * Horizontes que passam da última data da base ficam de fora (ainda não
 * aconteceram)
 *
 * @param ultimaData - Última data com cotação na base
 */
export function retornosFuturos(
  provider: Provider,
  ativoId: string,
  data: IsoDate,
  precoBase: number,
  horizontes: number[],
  ultimaData: IsoDate,
): RetornoFuturo[] {
  const retornos: RetornoFuturo[] = []
  for (const horizonte of horizontes) {
    const dataFim = addDays(data, horizonte)
    // Se o horizonte ainda não terminou na base
    if (dataFim > ultimaData) {
      continue
    }
    const retorno = retornoEntre(
      provider,
      ativoId,
      data,
      precoBase,
      dataFim,
      horizonte,
    )
    if (retorno) {
      retornos.push(retorno)
    }
  }
  return retornos
}

/** Observação da análise por faixa de score */
export interface ObservacaoScore {
  data: IsoDate
  score: number
  horizonte: number
  retornoTotal: number
}

/** Estatística de uma faixa de score em um horizonte */
export interface FaixaScore {
  /** Ex.: "60-69" ou "90+" */
  faixa: string
  horizonte: number
  observacoes: number
  retornoMedio: number
  retornoMediano: number
  /** Parte das observações com retorno positivo */
  acerto: number
  /**
   * Retorno médio acima da média de todos os ativos com score na mesma data
   * (tira o efeito do mercado)
   */
  excessoMedio: number
}

/** Mediana */
function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = ordenados.length >> 1
  return ordenados.length % 2
    ? ordenados[meio]
    : (ordenados[meio - 1] + ordenados[meio]) / 2
}

/** Nome da faixa do score (faixas de 10 pontos, 90 ou mais juntas) */
export function nomeFaixa(score: number, largura = 10): string {
  const inicio = Math.floor(Math.min(score, 99.999) / largura) * largura
  return inicio >= 90 ? '90+' : `${inicio}-${inicio + largura - 1}`
}

/**
 * Agrupa o retorno futuro por faixa de score e horizonte, para verificar se
 * score maior levou a retorno maior
 */
export function analisarFaixas(observacoes: ObservacaoScore[]): FaixaScore[] {
  // Calcula a média de retorno de cada data e horizonte (o "mercado")
  const mercado = new Map<string, { soma: number; n: number }>()
  for (const obs of observacoes) {
    const chave = `${obs.data}|${obs.horizonte}`
    const atual = mercado.get(chave) ?? { soma: 0, n: 0 }
    atual.soma += obs.retornoTotal
    atual.n++
    mercado.set(chave, atual)
  }

  // Agrupa as observações por faixa e horizonte
  const grupos = new Map<string, { retornos: number[]; excessos: number[] }>()
  for (const obs of observacoes) {
    const chave = `${nomeFaixa(obs.score)}|${obs.horizonte}`
    const grupo = grupos.get(chave) ?? { retornos: [], excessos: [] }
    const base = mercado.get(`${obs.data}|${obs.horizonte}`)
    grupo.retornos.push(obs.retornoTotal)
    grupo.excessos.push(obs.retornoTotal - (base ? base.soma / base.n : 0))
    grupos.set(chave, grupo)
  }

  return [...grupos.entries()]
    .map(([chave, grupo]) => {
      const [faixa, horizonte] = chave.split('|')
      const n = grupo.retornos.length
      return {
        faixa,
        horizonte: Number(horizonte),
        observacoes: n,
        retornoMedio: grupo.retornos.reduce((s, r) => s + r, 0) / n,
        retornoMediano: mediana(grupo.retornos),
        acerto: grupo.retornos.filter((r) => r > 0).length / n,
        excessoMedio: grupo.excessos.reduce((s, r) => s + r, 0) / n,
      }
    })
    .sort(
      (a, b) =>
        a.horizonte - b.horizonte ||
        Number.parseInt(a.faixa, 10) - Number.parseInt(b.faixa, 10),
    )
}
