import { addDays } from './dates.js'
import {
  ehAmortizacao,
  type PointInTimeView,
} from './HistoricalDataProvider.js'

/** Pregões por ano, para anualizar a volatilidade */
const PREGOES_ANO = 252

/** Mínimo de retornos diários para a volatilidade valer */
const MINIMO_RETORNOS = 20

/** Indicadores de mercado de um ativo em uma data (tudo antes da data) */
export interface IndicadoresMercado {
  /** Retorno total (preço + proventos, sem reinvestir), em % */
  retorno1m: number | null
  retorno3m: number | null
  retorno6m: number | null
  retorno12m: number | null
  /** Desvio padrão anualizado dos retornos diários de preço, em % */
  volatilidade3m: number | null
  volatilidade12m: number | null
  /** Preço atual em relação ao maior preço dos últimos 12 meses, em % (<= 0) */
  quedaDoTopo12m: number | null
}

/** Arredonda para 4 casas */
function arredondar(valor: number): number {
  return Math.round(valor * 10_000) / 10_000
}

/**
 * Calcula o retorno total do ativo nos últimos `dias` corridos antes da data:
 * do último fechamento até o início da janela ao último antes da data, com os
 * proventos do período e o ajuste de desdobramentos
 *
 * @returns Retorno em %, ou `null` se o ativo não tem preço no início da janela
 */
export function retornoJanela(
  view: PointInTimeView,
  ativoId: string,
  dias: number,
): number | null {
  const fim = view.ultimoPreco(ativoId)
  const inicio = view.precoAte(ativoId, addDays(view.data, -dias))
  // Se o ativo não negociava no início da janela
  if (!fim || !inicio || inicio.fechamento <= 0) {
    return null
  }

  // Converte o preço final e os proventos para a base de cotas do início
  const fatorInicio = view.fatorAjuste(ativoId, inicio.data)
  const precoFinal = fim.fechamento * fatorInicio
  const proventos = view
    .proventos(ativoId)
    .filter((p) => p.dataCom >= inicio.data)
    .reduce(
      (soma, p) =>
        soma + p.valor * (fatorInicio / view.fatorAjuste(ativoId, p.dataCom)),
      0,
    )
  return arredondar(((precoFinal + proventos) / inicio.fechamento - 1) * 100)
}

/**
 * Calcula a volatilidade anualizada dos retornos diários de preço nos
 * últimos `dias` corridos antes da data (só pares de pregões seguidos em que
 * o ativo negociou; desdobramentos ajustados)
 *
 * @returns Volatilidade em %, ou `null` com menos de 20 retornos
 */
export function volatilidadeJanela(
  view: PointInTimeView,
  ativoId: string,
  dias: number,
): number | null {
  const inicioJanela = addDays(view.data, -dias)
  const precos = view
    .precos(ativoId)
    .filter((preco) => preco.data >= inicioJanela)
  const eventos = view.eventos(ativoId)

  // Calcula os retornos diários ajustados por desdobramento
  const retornos: number[] = []
  for (let i = 1; i < precos.length; i++) {
    const anterior = precos[i - 1]
    const atual = precos[i]
    // Se falta preço
    if (anterior.fechamento <= 0 || atual.fechamento <= 0) {
      continue
    }
    const fator = eventos
      .filter((e) => e.data > anterior.data && e.data <= atual.data)
      .reduce((f, e) => f * (e.fator ?? 1), 1)
    retornos.push((atual.fechamento * fator) / anterior.fechamento - 1)
  }
  // Se há poucos retornos para a medida valer
  if (retornos.length < MINIMO_RETORNOS) {
    return null
  }

  const media = retornos.reduce((s, r) => s + r, 0) / retornos.length
  const variancia =
    retornos.reduce((s, r) => s + (r - media) ** 2, 0) / (retornos.length - 1)
  return arredondar(Math.sqrt(variancia) * Math.sqrt(PREGOES_ANO) * 100)
}

/**
 * Calcula quanto o preço atual está abaixo do maior preço dos últimos 12
 * meses (ajustado por desdobramento)
 *
 * @returns Queda em % (0 = no topo), ou `null` sem preço
 */
export function quedaDoTopo(
  view: PointInTimeView,
  ativoId: string,
  dias = 365,
): number | null {
  const inicioJanela = addDays(view.data, -dias)
  const precos = view
    .precos(ativoId)
    .filter((preco) => preco.data >= inicioJanela && preco.fechamento > 0)
  // Se o ativo não negociou na janela
  if (precos.length === 0) {
    return null
  }

  // Converte cada preço para a base de cotas atual e pega o maior
  const ajustados = precos.map(
    (preco) => preco.fechamento / view.fatorAjuste(ativoId, preco.data),
  )
  const topo = Math.max(...ajustados)
  const atual = ajustados[ajustados.length - 1]
  return arredondar((atual / topo - 1) * 100)
}

/** Calcula os indicadores de mercado do ativo na data da visão */
export function indicadoresMercado(
  view: PointInTimeView,
  ativoId: string,
): IndicadoresMercado {
  return {
    retorno1m: retornoJanela(view, ativoId, 30),
    retorno3m: retornoJanela(view, ativoId, 91),
    retorno6m: retornoJanela(view, ativoId, 182),
    retorno12m: retornoJanela(view, ativoId, 365),
    volatilidade3m: volatilidadeJanela(view, ativoId, 91),
    volatilidade12m: volatilidadeJanela(view, ativoId, 365),
    quedaDoTopo12m: quedaDoTopo(view, ativoId),
  }
}

/** Indicadores dos proventos dos últimos 12 meses antes da data */
export interface IndicadoresProventos {
  /** Rendimentos (sem amortizações) / preço, em % */
  dy12m: number | null
  /** Amortizações (devolução de capital) / preço, em % */
  amortizacao12m: number | null
  /**
   * Desvio / média dos rendimentos; `null` com menos de 6 pagamentos
   */
  variacaoDividendos: number | null
  /** Rendimentos dos últimos 6 meses / dos 6 anteriores - 1, em % */
  crescimentoDividendos: number | null
  /** Meses distintos com rendimento */
  mesesComProvento12m: number
  /** Fonte do provento mais recente (statusinvest, cvm_estimado) */
  fonteProventos: string | null
}

/**
 * Calcula os indicadores dos proventos dos últimos 12 meses antes da data,
 * com os valores levados para a base de cotas atual
 */
export function indicadoresProventos(
  view: PointInTimeView,
  ativoId: string,
  preco: number,
): IndicadoresProventos {
  const umAno = addDays(view.data, -365)
  const seisMeses = addDays(view.data, -182)
  const todos = view.proventos(ativoId)
  const ultimos = todos.filter((p) => p.dataCom >= umAno)
  const ajustado = (valor: number, dataCom: string) =>
    valor / view.fatorAjuste(ativoId, dataCom)

  // Separa rendimentos e amortizações
  const rendimentos = ultimos
    .filter((p) => !ehAmortizacao(p))
    .map((p) => ({ data: p.dataCom, valor: ajustado(p.valor, p.dataCom) }))
  const amortizacoes = ultimos
    .filter(ehAmortizacao)
    .reduce((s, p) => s + ajustado(p.valor, p.dataCom), 0)
  const soma = rendimentos.reduce((s, r) => s + r.valor, 0)

  // Calcula a estabilidade dos rendimentos
  let variacaoDividendos: number | null = null
  if (rendimentos.length >= 6) {
    const media = soma / rendimentos.length
    const desvio = Math.sqrt(
      rendimentos.reduce((s, r) => s + (r.valor - media) ** 2, 0) /
        (rendimentos.length - 1),
    )
    variacaoDividendos = media > 0 ? arredondar(desvio / media) : null
  }

  // Compara os últimos 6 meses com os 6 anteriores
  const recentes = rendimentos
    .filter((r) => r.data >= seisMeses)
    .reduce((s, r) => s + r.valor, 0)
  const anteriores = soma - recentes
  const crescimentoDividendos =
    anteriores > 0 && recentes > 0
      ? arredondar((recentes / anteriores - 1) * 100)
      : null

  return {
    dy12m:
      preco > 0 && rendimentos.length > 0
        ? arredondar((soma / preco) * 100)
        : null,
    amortizacao12m: preco > 0 ? arredondar((amortizacoes / preco) * 100) : null,
    variacaoDividendos,
    crescimentoDividendos,
    mesesComProvento12m: new Set(rendimentos.map((r) => r.data.slice(0, 7)))
      .size,
    fonteProventos: todos.at(-1)?.fonte ?? null,
  }
}
