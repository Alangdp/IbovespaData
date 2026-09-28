import type { Backtest } from './Backtest.js'
import { addMonths } from './dates.js'
import type { AtivoSnapshot } from './HistoricalDataProvider.js'
import type { BacktestConfig, IsoDate } from './types.js'

/** Resultado de uma janela da análise de robustez */
export interface JanelaRobustez {
  scoreVersao: string
  inicio: IsoDate
  fim: IsoDate
  aportado: number
  patrimonioFinal: number
  cagr: number | null
  tir: number | null
  drawdownMaximo: number
  volatilidade: number | null
  sharpe: number | null
  benchmarkCagr: number | null
  excessoCagr: number | null
  /** A estratégia terminou com mais patrimônio que o benchmark */
  bateuBenchmark: boolean
}

/** Distribuição de uma métrica entre as janelas */
export interface Distribuicao {
  minimo: number | null
  p25: number | null
  mediana: number | null
  p75: number | null
  maximo: number | null
}

/** Resumo da robustez de uma versão de score */
export interface ResumoRobustez {
  scoreVersao: string
  janelas: number
  cagr: Distribuicao
  tir: Distribuicao
  excessoCagr: Distribuicao
  drawdownMaximo: Distribuicao
  /** Parte das janelas em que a estratégia bateu o benchmark */
  bateuBenchmark: number
}

/** Calcula mínimo, quartis, mediana e máximo */
export function distribuicao(valores: (number | null)[]): Distribuicao {
  const ordenados = valores
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b)
  // Se não há valores
  if (ordenados.length === 0) {
    return { minimo: null, p25: null, mediana: null, p75: null, maximo: null }
  }
  const quantil = (p: number) => {
    const posicao = (ordenados.length - 1) * p
    const baixo = Math.floor(posicao)
    const alto = Math.ceil(posicao)
    return (
      ordenados[baixo] +
      (ordenados[alto] - ordenados[baixo]) * (posicao - baixo)
    )
  }
  return {
    minimo: ordenados[0],
    p25: quantil(0.25),
    mediana: quantil(0.5),
    p75: quantil(0.75),
    maximo: ordenados[ordenados.length - 1],
  }
}

/**
 * Executa a mesma estratégia com início em cada mês (a cada `passoMeses`)
 * e duração de `anos`, para medir quanto o resultado depende da data de
 * início
 *
 * A duração vem de `config.anos` (padrão 5). Só entram janelas que terminam
 * dentro da base
 */
export function executarRobustez<TSnapshot extends AtivoSnapshot>(
  backtest: Backtest<TSnapshot>,
  config: BacktestConfig,
  versoes: string[],
  passoMeses = 1,
  progresso?: (janela: JanelaRobustez) => void,
): { janelas: JanelaRobustez[]; resumos: ResumoRobustez[] } {
  const anos = config.anos ?? 5
  const pregoes = backtest.provider.pregoes()
  const ultimo = pregoes[pregoes.length - 1]
  const primeiro = backtest.provider.dataMinima()

  // Monta as janelas: do primeiro mês com dados até o último início que
  // ainda cabe na base
  const inicios: IsoDate[] = []
  for (
    let inicio = primeiro;
    addMonths(inicio, 12 * anos) <= ultimo;
    inicio = addMonths(inicio, passoMeses)
  ) {
    inicios.push(inicio)
  }

  const janelas: JanelaRobustez[] = []
  for (const versao of versoes) {
    for (const inicio of inicios) {
      const fim = addMonths(inicio, 12 * anos)
      const { resumo, scoreVersao } = backtest.executar({
        ...config,
        anos: undefined,
        inicio,
        fim,
        score: versao,
      })
      const janela: JanelaRobustez = {
        scoreVersao,
        inicio,
        fim,
        aportado: resumo.estrategia.aportado,
        patrimonioFinal: resumo.estrategia.patrimonioFinal,
        cagr: resumo.estrategia.cagr,
        tir: resumo.estrategia.tir,
        drawdownMaximo: resumo.estrategia.drawdownMaximo,
        volatilidade: resumo.estrategia.volatilidade,
        sharpe: resumo.estrategia.sharpe,
        benchmarkCagr: resumo.benchmark.cagr,
        excessoCagr: resumo.excessoCagr,
        bateuBenchmark: resumo.excessoPatrimonio > 0,
      }
      janelas.push(janela)
      progresso?.(janela)
    }
  }

  // Resume cada versão
  const resumos = versoes.map((versao): ResumoRobustez => {
    const daVersao = janelas.filter((j) => j.scoreVersao === versao)
    return {
      scoreVersao: versao,
      janelas: daVersao.length,
      cagr: distribuicao(daVersao.map((j) => j.cagr)),
      tir: distribuicao(daVersao.map((j) => j.tir)),
      excessoCagr: distribuicao(daVersao.map((j) => j.excessoCagr)),
      drawdownMaximo: distribuicao(daVersao.map((j) => j.drawdownMaximo)),
      bateuBenchmark: daVersao.length
        ? daVersao.filter((j) => j.bateuBenchmark).length / daVersao.length
        : 0,
    }
  })
  return { janelas, resumos }
}
