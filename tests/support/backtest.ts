// Provider, score e backtest sintéticos para testar o núcleo do backtest sem
// base de dados
import { Backtest } from '../../src/backtest/core/Backtest'
import {
  type AtivoInfo,
  type AtivoSnapshot,
  HistoricalDataProvider,
  type PointInTimeView,
  type PrecoDia,
  type Provento,
} from '../../src/backtest/core/HistoricalDataProvider'
import { type ScoreConfig, Scorer } from '../../src/backtest/core/Scorer'
import type { EventoAtivo, IsoDate } from '../../src/backtest/core/types'

/** Snapshot de teste: uma "nota" que o ativo publica com data de entrega */
export interface TesteSnapshot extends AtivoSnapshot {
  nota: number | null
}

/** Nota publicada de um ativo, conhecida a partir da entrega */
export interface NotaPublicada {
  ativoId: string
  entrega: IsoDate
  nota: number
}

/** Dados do provider sintético */
export interface DadosTeste {
  pregoes: IsoDate[]
  /** Fechamento de cada ativo em cada pregão (null = sem negócio) */
  precos: Record<string, (number | null)[]>
  proventos?: Provento[]
  eventos?: EventoAtivo[]
  notas?: NotaPublicada[]
  /** CDI de cada pregão (padrão 0) */
  cdi?: number
}

/** Provider em memória: o snapshot usa a última nota entregue antes da data */
export class TesteProvider extends HistoricalDataProvider<TesteSnapshot> {
  readonly tipoAtivo = 'teste'
  private readonly lista: AtivoInfo[]
  private readonly mapa = new Map<string, PrecoDia[]>()

  constructor(private readonly dados: DadosTeste) {
    super()
    this.lista = Object.entries(dados.precos).map(([ativoId, serie]) => {
      const precos: PrecoDia[] = []
      serie.forEach((fechamento, i) => {
        if (fechamento !== null) {
          precos.push({ data: dados.pregoes[i], fechamento, volume: 1_000_000 })
        }
      })
      this.mapa.set(ativoId, precos)
      return {
        ativoId,
        ticker: ativoId,
        primeiraData: precos[0].data,
        ultimaData: precos[precos.length - 1].data,
      }
    })
  }

  pregoes() {
    return this.dados.pregoes
  }

  ativos() {
    return this.lista
  }

  precos(ativoId: string) {
    return this.mapa.get(ativoId) ?? []
  }

  proventos(ativoId: string) {
    return (this.dados.proventos ?? []).filter((p) => p.ativoId === ativoId)
  }

  eventos(ativoId: string) {
    return (this.dados.eventos ?? []).filter((e) => e.ativoId === ativoId)
  }

  cdi() {
    return new Map(
      this.dados.pregoes.map((data) => [data, this.dados.cdi ?? 0]),
    )
  }

  dataMinima() {
    return this.dados.pregoes[0]
  }

  protected montarSnapshot(
    ativo: AtivoInfo,
    view: PointInTimeView,
    base: AtivoSnapshot,
  ): TesteSnapshot {
    // Usa só as notas entregues antes da data
    const nota = (this.dados.notas ?? [])
      .filter((n) => n.ativoId === ativo.ativoId && n.entrega < view.data)
      .at(-1)
    return { ...base, nota: nota?.nota ?? null }
  }
}

export const SCORE_TESTE: ScoreConfig<TesteSnapshot> = {
  versao: 'teste-v1',
  descricao: 'nota publicada',
  coberturaMinima: 1,
  criterios: [
    {
      criterio: 'nota',
      peso: 1,
      valor: (s) => s.nota,
      faixa: [
        [0, 0],
        [100, 100],
      ],
    },
  ],
}

class TesteScorer extends Scorer<TesteSnapshot> {}

/** Backtest sobre o provider sintético */
export class TesteBacktest extends Backtest<TesteSnapshot> {
  versoesScore() {
    return [SCORE_TESTE.versao]
  }

  criarScorer() {
    return new TesteScorer(SCORE_TESTE)
  }
}

/** Gera os dias úteis (segunda a sexta) entre duas datas */
export function diasUteis(inicio: IsoDate, fim: IsoDate): IsoDate[] {
  const dias: IsoDate[] = []
  for (
    let d = new Date(`${inicio}T00:00:00Z`);
    d <= new Date(`${fim}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const semana = d.getUTCDay()
    if (semana !== 0 && semana !== 6) {
      dias.push(d.toISOString().slice(0, 10))
    }
  }
  return dias
}
