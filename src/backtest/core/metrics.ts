import { daysBetween } from './dates.js'
import type { IsoDate, Metricas } from './types.js'

/** Pregões por ano, para anualizar a volatilidade */
const PREGOES_ANO = 252

/** Série diária de uma carteira (estratégia ou benchmark) */
export interface SerieCarteira {
  datas: IsoDate[]
  /** Valor da cota (retorno sem o efeito dos aportes) */
  cotas: number[]
  patrimonio: number[]
  /** Total aportado até cada data */
  aportado: number[]
  /** CDI de cada dia (fração), para o retorno em excesso */
  cdi: number[]
}

/** Média */
function media(valores: number[]): number {
  return valores.reduce((sum, valor) => sum + valor, 0) / valores.length
}

/** Desvio padrão amostral */
function desvio(valores: number[]): number {
  const m = media(valores)
  return Math.sqrt(
    valores.reduce((sum, valor) => sum + (valor - m) ** 2, 0) /
      (valores.length - 1),
  )
}

/** Maior queda da série em relação ao pico anterior (fração negativa ou 0) */
export function drawdownMaximo(valores: number[]): number {
  let pico = Number.NEGATIVE_INFINITY
  let pior = 0
  for (const valor of valores) {
    pico = Math.max(pico, valor)
    if (pico > 0) {
      pior = Math.min(pior, valor / pico - 1)
    }
  }
  return pior
}

/**
 * Calcula a taxa interna de retorno anual de fluxos datados (XIRR), por
 * bisseção
 *
 * @param fluxos - Aportes negativos e o resgate (patrimônio final) positivo
 * @returns `null` se não houver solução no intervalo
 */
export function tir(fluxos: { data: IsoDate; valor: number }[]): number | null {
  // Se não há fluxo dos dois sinais
  if (
    !fluxos.some((fluxo) => fluxo.valor < 0) ||
    !fluxos.some((fluxo) => fluxo.valor > 0)
  ) {
    return null
  }

  const inicio = fluxos[0].data
  const vpl = (taxa: number) =>
    fluxos.reduce(
      (sum, fluxo) =>
        sum +
        fluxo.valor / (1 + taxa) ** (daysBetween(inicio, fluxo.data) / 365),
      0,
    )

  // Procura a taxa que zera o valor presente entre -99% e 1000% ao ano
  let baixa = -0.99
  let alta = 10
  let vplBaixa = vpl(baixa)
  // Se não há troca de sinal no intervalo
  if (vplBaixa * vpl(alta) > 0) {
    return null
  }
  for (let i = 0; i < 200; i++) {
    const meio = (baixa + alta) / 2
    const vplMeio = vpl(meio)
    if (vplBaixa * vplMeio <= 0) {
      alta = meio
    } else {
      baixa = meio
      vplBaixa = vplMeio
    }
  }
  return (baixa + alta) / 2
}

/**
 * Calcula as métricas de uma carteira a partir da série diária
 *
 * Retorno, CAGR, volatilidade, Sharpe e Sortino usam a cota (sem o efeito
 * dos aportes); a TIR usa os aportes e o patrimônio final. Sharpe e Sortino
 * usam o CDI do dia como taxa livre de risco
 */
export function calcularMetricas(serie: SerieCarteira): Metricas {
  const n = serie.datas.length
  const aportado = serie.aportado[n - 1] ?? 0
  const patrimonioFinal = serie.patrimonio[n - 1] ?? 0

  // Calcula os retornos diários da cota e o excesso sobre o CDI
  const retornos: number[] = []
  const excessos: number[] = []
  for (let i = 1; i < n; i++) {
    const retorno = serie.cotas[i] / serie.cotas[i - 1] - 1
    retornos.push(retorno)
    excessos.push(retorno - serie.cdi[i])
  }

  // Calcula o CAGR da cota no período
  const dias = n > 1 ? daysBetween(serie.datas[0], serie.datas[n - 1]) : 0
  const retornoCota = n > 0 ? serie.cotas[n - 1] / serie.cotas[0] - 1 : 0
  const cagr = dias >= 30 ? (1 + retornoCota) ** (365 / dias) - 1 : null

  // Calcula a volatilidade, o Sharpe e o Sortino anualizados
  let volatilidade: number | null = null
  let sharpe: number | null = null
  let sortino: number | null = null
  if (retornos.length >= 2) {
    volatilidade = desvio(retornos) * Math.sqrt(PREGOES_ANO)
    const excessoAnual = media(excessos) * PREGOES_ANO
    const desvioExcesso = desvio(excessos) * Math.sqrt(PREGOES_ANO)
    sharpe = desvioExcesso > 0 ? excessoAnual / desvioExcesso : null
    const desvioNegativo =
      Math.sqrt(media(excessos.map((e) => Math.min(e, 0) ** 2))) *
      Math.sqrt(PREGOES_ANO)
    sortino = desvioNegativo > 0 ? excessoAnual / desvioNegativo : null
  }

  // Monta os fluxos da TIR: cada aporte e o resgate no fim
  const fluxos: { data: IsoDate; valor: number }[] = []
  for (let i = 0; i < n; i++) {
    const aporte = serie.aportado[i] - (i > 0 ? serie.aportado[i - 1] : 0)
    if (aporte > 0) {
      fluxos.push({ data: serie.datas[i], valor: -aporte })
    }
  }
  if (n > 0) {
    fluxos.push({ data: serie.datas[n - 1], valor: patrimonioFinal })
  }

  return {
    aportado,
    patrimonioFinal,
    retornoAcumulado: aportado > 0 ? patrimonioFinal / aportado - 1 : 0,
    retornoCota,
    cagr,
    tir: tir(fluxos),
    drawdownMaximo: drawdownMaximo(serie.cotas),
    volatilidade,
    sharpe,
    sortino,
  }
}
