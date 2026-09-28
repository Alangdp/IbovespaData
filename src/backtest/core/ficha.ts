import type { DatasetStore } from './DatasetStore.js'
import { colunaScore } from './dataset.js'
import type { FeatureDef } from './features.js'
import type {
  AtivoSnapshot,
  HistoricalDataProvider,
} from './HistoricalDataProvider.js'
import type { Scorer } from './Scorer.js'
import type { IsoDate } from './types.js'

/** Alerta exibido na ficha */
export interface AlertaFicha {
  codigo: string
  severidade: string
  mensagem: string
}

/** Quanto cada critério pesou no score */
export interface ContribuicaoCriterio {
  criterio: string
  valor: number | boolean | null
  /** Nota do critério (0 a 100); `null` = sem dado (não entra na conta) */
  nota: number | null
  peso: number
  /** Pontos que o critério somou ao score */
  contribuicao: number | null
  /** Pontos que faltaram para a nota máxima no critério */
  perdido: number | null
}

/** Estatística dos retornos de situações parecidas no passado */
export interface Historico {
  horizonte: number
  /** Casos com o horizonte já terminado antes da data da ficha */
  casos: number
  mediana: number | null
  /** 10% dos casos renderam menos que isto */
  p10: number | null
  /** 10% dos casos renderam mais que isto */
  p90: number | null
  /** Parte dos casos com retorno positivo */
  positivos: number | null
  bateuMercado: number | null
  bateuCdi: number | null
}

/** Ficha de decisão de um ativo numa data */
export interface Ficha {
  data: IsoDate
  ativoId: string
  ticker: string
  grupo: string | null
  features: {
    nome: string
    grupo: string
    descricao: string
    unidade: string
    valor: number | boolean | string | null
  }[]
  score: {
    versao: string
    score: number | null
    cobertura: number | null
    /** Posição no ranking de todos os ativos da data (1 = melhor) */
    posicao: number | null
    totalRanking: number
    /** Parte dos ativos do mesmo grupo com score menor (0 a 1) */
    percentilGrupo: number | null
    criterios: ContribuicaoCriterio[]
  }
  /** Melhores do mesmo grupo pelo score */
  pares: { ticker: string; score: number; posicao: number }[]
  alertas: AlertaFicha[]
  /**
   * Retornos de ativos do mesmo grupo com score parecido (±5 pontos) no
   * passado; vazio sem dataset
   */
  historicoParecidos: Historico[]
  /** Retornos depois das datas anteriores do próprio ativo; vazio sem dataset */
  historicoProprio: {
    data: IsoDate
    score: number | null
    retorno365: number | null
    retorno90: number | null
  }[]
  /** Aviso quando falta o dataset para os históricos */
  aviso: string | null
}

/** Configuração da ficha para um tipo de ativo */
export interface OpcoesFicha<TSnapshot extends AtivoSnapshot> {
  features: FeatureDef<TSnapshot>[]
  /** Grupo de comparação (ex.: segmento do FII) */
  grupo: (snapshot: TSnapshot) => string | null
  /** Coluna do grupo no dataset */
  colunaGrupo: string
  alertas: (snapshot: TSnapshot) => AlertaFicha[]
  /** Dataset para os históricos (tabela e acesso) */
  dataset?: { store: DatasetStore; tabela: string }
}

/** Percentil `p` (0 a 1) de uma lista ordenada */
function percentil(ordenados: number[], p: number): number | null {
  // Se a lista está vazia
  if (ordenados.length === 0) {
    return null
  }
  const posicao = (ordenados.length - 1) * p
  const baixo = Math.floor(posicao)
  const alto = Math.ceil(posicao)
  return (
    ordenados[baixo] + (ordenados[alto] - ordenados[baixo]) * (posicao - baixo)
  )
}

/** Faixa de pontos em torno do score para as situações parecidas */
const FAIXA_PARECIDOS = 5

/**
 * Monta a ficha de decisão do ativo na data: os dados conhecidos, o score
 * explicado critério a critério, a posição entre os pares, os alertas e o que
 * aconteceu no passado em situações parecidas
 *
 * Os históricos só usam casos cujo horizonte terminou antes da data, então a
 * ficha de uma data passada mostra o que se sabia naquele dia
 *
 * @throws Error se o ativo não está no universo da data
 */
export function montarFicha<TSnapshot extends AtivoSnapshot>(
  provider: HistoricalDataProvider<TSnapshot>,
  scorer: Scorer<TSnapshot>,
  ticker: string,
  data: IsoDate,
  opcoes: OpcoesFicha<TSnapshot>,
): Ficha {
  const universo = provider.universo(data)
  const snapshot = universo.find((s) => s.ticker === ticker.toUpperCase())
  // Se o ativo não está no universo da data
  if (!snapshot) {
    throw new Error(
      `${ticker} não está no universo em ${data} (não negociou nos últimos pregões ou não existe na base)`,
    )
  }

  // Calcula o score e a contribuição de cada critério
  const ranking = scorer.ranking(universo)
  const item = ranking.find((r) => r.ativoId === snapshot.ativoId) ?? null
  const resultado = scorer.avaliar(snapshot)
  const criteriosBrutos = resultado?.criterios ?? scorer.criterios(snapshot)
  const pesoAvaliado = criteriosBrutos
    .filter((c) => c.nota !== null)
    .reduce((s, c) => s + c.peso, 0)
  const criterios = criteriosBrutos.map((c) => ({
    criterio: c.criterio,
    valor: c.valor,
    nota: c.nota === null ? null : Math.round(c.nota * 100) / 100,
    peso: c.peso,
    contribuicao:
      c.nota === null || pesoAvaliado === 0
        ? null
        : Math.round(((c.nota * c.peso) / pesoAvaliado) * 100) / 100,
    perdido:
      c.nota === null || pesoAvaliado === 0
        ? null
        : Math.round((((100 - c.nota) * c.peso) / pesoAvaliado) * 100) / 100,
  }))

  // Compara com os ativos do mesmo grupo
  const grupo = opcoes.grupo(snapshot)
  const doGrupo = ranking.filter((r) => {
    const s = universo.find((u) => u.ativoId === r.ativoId)
    return s && grupo !== null && opcoes.grupo(s) === grupo
  })
  const percentilGrupo =
    item && doGrupo.length > 1
      ? doGrupo.filter((r) => r.score < item.score).length /
        (doGrupo.length - 1)
      : null

  const ficha: Ficha = {
    data,
    ativoId: snapshot.ativoId,
    ticker: snapshot.ticker,
    grupo,
    features: opcoes.features.map((f) => ({
      nome: f.nome,
      grupo: f.grupo,
      descricao: f.descricao,
      unidade: f.unidade,
      valor: f.valor(snapshot),
    })),
    score: {
      versao: scorer.versao,
      score: item?.score ?? null,
      cobertura: resultado?.cobertura ?? null,
      posicao: item?.posicao ?? null,
      totalRanking: ranking.length,
      percentilGrupo,
      criterios,
    },
    pares: doGrupo.slice(0, 5).map((r) => ({
      ticker: r.ticker,
      score: r.score,
      posicao: r.posicao,
    })),
    alertas: opcoes.alertas(snapshot),
    historicoParecidos: [],
    historicoProprio: [],
    aviso: null,
  }

  // Busca os históricos no dataset, se houver
  const dataset = opcoes.dataset
  const meta = dataset?.store.meta(dataset.tabela) ?? null
  const coluna = colunaScore(scorer.versao)
  const temScore =
    meta &&
    (meta.opcoes as { scores?: string[] })?.scores?.includes(scorer.versao)
  if (!dataset || !meta || !temScore) {
    ficha.aviso = `sem dataset com o score ${scorer.versao}: rode \`bun run backtest dataset\` para ver o histórico de situações parecidas`
    return ficha
  }

  // Situações parecidas: mesmo grupo, score perto, horizonte já terminado
  if (item && grupo !== null) {
    for (const horizonte of [90, 365]) {
      const h = `${horizonte}d`
      const linhas = dataset.store.consultar<{
        r: number
        m: number | null
        c: number | null
      }>(
        `SELECT ret_total_${h} AS r, bateu_mercado_${h} AS m, bateu_cdi_${h} AS c
         FROM ${dataset.tabela}
         WHERE "${opcoes.colunaGrupo}" = ? AND ${coluna} BETWEEN ? AND ?
           AND data_fim_${h} < ? AND ret_total_${h} IS NOT NULL`,
        grupo,
        item.score - FAIXA_PARECIDOS,
        item.score + FAIXA_PARECIDOS,
        data,
      )
      const retornos = linhas.map((l) => l.r).sort((a, b) => a - b)
      const media = (valores: (number | null)[]) => {
        const validos = valores.filter((v): v is number => v !== null)
        return validos.length
          ? validos.reduce((s, v) => s + v, 0) / validos.length
          : null
      }
      ficha.historicoParecidos.push({
        horizonte,
        casos: retornos.length,
        mediana: percentil(retornos, 0.5),
        p10: percentil(retornos, 0.1),
        p90: percentil(retornos, 0.9),
        positivos: retornos.length
          ? retornos.filter((r) => r > 0).length / retornos.length
          : null,
        bateuMercado: media(linhas.map((l) => l.m)),
        bateuCdi: media(linhas.map((l) => l.c)),
      })
    }
  }

  // Histórico do próprio ativo: as últimas datas antes da ficha
  ficha.historicoProprio = dataset.store
    .consultar<{
      data: string
      score: number | null
      r365: number | null
      r90: number | null
    }>(
      `SELECT data, ${coluna} AS score,
         CASE WHEN data_fim_365d < ? THEN ret_total_365d END AS r365,
         CASE WHEN data_fim_90d < ? THEN ret_total_90d END AS r90
       FROM ${dataset.tabela}
       WHERE ativo_id = ? AND data < ?
       ORDER BY data DESC LIMIT 12`,
      data,
      data,
      snapshot.ativoId,
      data,
    )
    .map((l) => ({
      data: l.data,
      score: l.score,
      retorno365: l.r365,
      retorno90: l.r90,
    }))
  return ficha
}
