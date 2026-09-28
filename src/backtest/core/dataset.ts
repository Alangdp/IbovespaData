import { datasAporte } from './dates.js'
import type { FeatureDef, TipoFeature } from './features.js'
import type {
  AtivoSnapshot,
  HistoricalDataProvider,
} from './HistoricalDataProvider.js'
import { rotulosFuturos } from './rotulos.js'
import type { Scorer } from './Scorer.js'
import type { IsoDate } from './types.js'

/** Horizontes padrão dos rótulos (dias corridos) */
export const HORIZONTES_DATASET = [30, 90, 180, 365, 730, 1825]

/**
 * Liquidez mínima (R$/dia) dos fundos que formam o "mercado" dos rótulos de
 * excesso: a média de quem dava para comprar de verdade
 */
export const LIQUIDEZ_MERCADO = 500_000

/** Opções da montagem do dataset */
export interface OpcoesDataset<TSnapshot extends AtivoSnapshot> {
  /** Primeira data; padrão: a data mínima do provider */
  inicio?: IsoDate
  /** Última data; padrão: o último pregão */
  fim?: IsoDate
  /** Uma linha por fundo em cada mês (1º pregão) ou semana (1º pregão) */
  frequencia: 'mensal' | 'semanal'
  horizontes: number[]
  /** Scores calculados em cada linha (colunas `score_<versao>`) */
  scorers: Scorer<TSnapshot>[]
}

/** Coluna do dataset */
export interface ColunaDataset {
  nome: string
  tipo: TipoFeature
  /** Descrição curta (vai para o dicionário) */
  descricao: string
}

/** Valor de uma célula */
export type ValorDataset = number | string | boolean | null

/** Dataset montado */
export interface Dataset {
  colunas: ColunaDataset[]
  linhas: Record<string, ValorDataset>[]
}

/** Nome da coluna de score de uma versão (`fii-v1` -> `score_fii_v1`) */
export function colunaScore(versao: string): string {
  return `score_${versao.replace(/\W+/g, '_')}`
}

/** Colunas de rótulo de um horizonte e o que cada uma significa */
export function colunasRotulo(horizonte: number): ColunaDataset[] {
  const h = `${horizonte}d`
  return [
    {
      nome: `data_fim_${h}`,
      tipo: 'texto',
      descricao: `último pregão até data + ${horizonte} dias`,
    },
    {
      nome: `ret_total_${h}`,
      tipo: 'numero',
      descricao: `retorno total (preço + proventos sem reinvestir) em ${horizonte} dias, fração`,
    },
    {
      nome: `ret_preco_${h}`,
      tipo: 'numero',
      descricao: `retorno do preço em ${horizonte} dias, fração`,
    },
    {
      nome: `ret_div_${h}`,
      tipo: 'numero',
      descricao: `proventos recebidos em ${horizonte} dias / preço de compra, fração`,
    },
    {
      nome: `drawdown_${h}`,
      tipo: 'numero',
      descricao: `pior queda do valor (preço + proventos) dentro dos ${horizonte} dias, fração <= 0`,
    },
    {
      nome: `excesso_mercado_${h}`,
      tipo: 'numero',
      descricao: `ret_total menos a média dos fundos com liquidez >= ${LIQUIDEZ_MERCADO} na mesma data`,
    },
    {
      nome: `excesso_cdi_${h}`,
      tipo: 'numero',
      descricao: `ret_total menos o CDI acumulado no mesmo período`,
    },
    {
      nome: `bateu_mercado_${h}`,
      tipo: 'booleano',
      descricao: 'excesso_mercado > 0',
    },
    {
      nome: `bateu_cdi_${h}`,
      tipo: 'booleano',
      descricao: 'excesso_cdi > 0',
    },
    {
      nome: `percentil_${h}`,
      tipo: 'numero',
      descricao:
        'posição do ret_total entre os fundos da mesma data (0 = pior, 1 = melhor)',
    },
    {
      nome: `completo_${h}`,
      tipo: 'booleano',
      descricao:
        'false se o fundo parou de negociar antes do fim do horizonte (retorno pelo último preço)',
    },
  ]
}

/** Colunas fixas do início de cada linha */
export const COLUNAS_BASE: ColunaDataset[] = [
  {
    nome: 'data',
    tipo: 'texto',
    descricao: 'data da decisão (features com dados de antes dela)',
  },
  {
    nome: 'ativo_id',
    tipo: 'texto',
    descricao: 'ISIN (identificador estável)',
  },
  { nome: 'ticker', tipo: 'texto', descricao: 'ticker mais recente' },
  {
    nome: 'preco_base',
    tipo: 'numero',
    descricao:
      'preço de compra dos rótulos: fechamento da data (ou o anterior, se não negociou)',
  },
  {
    nome: 'negociou_no_dia',
    tipo: 'booleano',
    descricao:
      'houve negócio na data (senão preco_base é o fechamento anterior)',
  },
]

/**
 * Monta o dataset: uma linha por ativo do universo em cada data, com as
 * features (dados de antes da data), os scores e os rótulos (o que aconteceu
 * depois)
 *
 * Os rótulos olham para o futuro de propósito: são o que o modelo deve
 * aprender a prever, nunca uma entrada. Linhas cujo horizonte ainda não
 * terminou ficam com o rótulo vazio
 */
export function montarDataset<TSnapshot extends AtivoSnapshot>(
  provider: HistoricalDataProvider<TSnapshot>,
  features: FeatureDef<TSnapshot>[],
  opcoes: OpcoesDataset<TSnapshot>,
  progresso?: (data: IsoDate, linhas: number) => void,
): Dataset {
  const pregoes = provider.pregoes()
  const ultimaData = pregoes[pregoes.length - 1]
  const inicio = opcoes.inicio ?? provider.dataMinima()
  const fim = opcoes.fim ?? ultimaData
  const datas = datasAporte(
    pregoes.filter((data) => data >= inicio && data <= fim),
    opcoes.frequencia,
    1,
  )

  // Monta as colunas: base, features, scores e rótulos
  const colunas: ColunaDataset[] = [
    ...COLUNAS_BASE,
    ...features.map((f) => ({
      nome: f.nome,
      tipo: f.tipo,
      descricao: f.descricao,
    })),
    ...opcoes.scorers.flatMap((scorer) => [
      {
        nome: colunaScore(scorer.versao),
        tipo: 'numero' as const,
        descricao: `score ${scorer.versao} (0 a 100; vazio sem cobertura mínima)`,
      },
      {
        nome: `${colunaScore(scorer.versao)}_posicao`,
        tipo: 'numero' as const,
        descricao: `posição no ranking do ${scorer.versao} entre os fundos da data (1 = melhor)`,
      },
    ]),
    ...opcoes.horizontes.flatMap(colunasRotulo),
  ]

  const linhas: Record<string, ValorDataset>[] = []
  for (const data of datas) {
    const universo = provider.universo(data)

    // Calcula os scores e a posição no ranking de cada versão
    const scores = opcoes.scorers.map((scorer) => {
      const ranking = scorer.ranking(universo)
      return new Map(ranking.map((item) => [item.ativoId, item]))
    })

    // Monta as linhas da data
    const daData: Record<string, ValorDataset>[] = []
    for (const snapshot of universo) {
      const precoDia = provider.precoNoDia(snapshot.ativoId, data)
      const precoBase = precoDia ?? snapshot.preco
      const linha: Record<string, ValorDataset> = {
        data,
        ativo_id: snapshot.ativoId,
        ticker: snapshot.ticker,
        preco_base: precoBase,
        negociou_no_dia: precoDia !== null,
      }
      for (const feature of features) {
        linha[feature.nome] = feature.valor(snapshot)
      }
      opcoes.scorers.forEach((scorer, i) => {
        const item = scores[i].get(snapshot.ativoId)
        linha[colunaScore(scorer.versao)] = item?.score ?? null
        linha[`${colunaScore(scorer.versao)}_posicao`] = item?.posicao ?? null
      })

      // Calcula os rótulos de cada horizonte
      const rotulos = rotulosFuturos(
        provider,
        snapshot.ativoId,
        data,
        precoBase,
        opcoes.horizontes,
        ultimaData,
      )
      for (const r of rotulos) {
        const h = `${r.horizonte}d`
        linha[`data_fim_${h}`] = r.dataFinal
        linha[`ret_total_${h}`] = r.retornoTotal
        linha[`ret_preco_${h}`] = r.retornoPreco
        linha[`ret_div_${h}`] = r.retornoDividendos
        linha[`drawdown_${h}`] = r.drawdown
        linha[`excesso_cdi_${h}`] =
          r.retornoTotal - provider.cdiEntre(data, r.dataFinal)
        linha[`completo_${h}`] = r.completo
      }
      daData.push(linha)
    }

    // Calcula os rótulos relativos: excesso sobre o mercado e percentil
    for (const horizonte of opcoes.horizontes) {
      const h = `${horizonte}d`
      const comRotulo = daData.filter(
        (linha) => typeof linha[`ret_total_${h}`] === 'number',
      )
      const mercado = comRotulo.filter(
        (linha) => Number(linha.liquidez_media ?? 0) >= LIQUIDEZ_MERCADO,
      )
      const media =
        mercado.length > 0
          ? mercado.reduce((s, l) => s + Number(l[`ret_total_${h}`]), 0) /
            mercado.length
          : null
      const ordenados = comRotulo
        .map((linha) => Number(linha[`ret_total_${h}`]))
        .sort((a, b) => a - b)
      for (const linha of comRotulo) {
        const retorno = Number(linha[`ret_total_${h}`])
        const excessoCdi = Number(linha[`excesso_cdi_${h}`])
        if (media !== null) {
          linha[`excesso_mercado_${h}`] = retorno - media
          linha[`bateu_mercado_${h}`] = retorno > media
        }
        linha[`bateu_cdi_${h}`] = excessoCdi > 0
        // Posição pelo número de retornos menores (empates no meio)
        const menores = ordenados.filter((v) => v < retorno).length
        const iguais = ordenados.filter((v) => v === retorno).length
        linha[`percentil_${h}`] =
          ordenados.length > 1
            ? (menores + (iguais - 1) / 2) / (ordenados.length - 1)
            : 0.5
      }
    }

    linhas.push(...daData)
    progresso?.(data, linhas.length)
  }

  // Preenche com null as células que ficaram sem valor
  for (const linha of linhas) {
    for (const coluna of colunas) {
      linha[coluna.nome] ??= null
    }
  }
  return { colunas, linhas }
}
