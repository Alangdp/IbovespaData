import { type ScoreConfig, Scorer } from '../core/Scorer.js'
import type { FiiSnapshot } from './FiiHistoricalProvider.js'

/**
 * Score de FII v1: os critérios que a API já calcula e que têm histórico
 * (P/VP, DY, liquidez, taxa, alavancagem, vacância, diversificação, limite de
 * distribuição e estabilidade dos rendimentos)
 *
 * Ficam de fora os critérios sem histórico confiável: gestora confiável (a
 * lista é de hoje), LTV e spread (relatório gerencial) e boa localização
 * (classificação das cidades feita com os dados atuais)
 */
export const FII_SCORE_V1: ScoreConfig<FiiSnapshot> = {
  versao: 'fii-v1',
  descricao:
    'P/VP, DY 12m, liquidez, taxa de administração, alavancagem, vacância, diversificação, limite de distribuição e estabilidade dos rendimentos',
  coberturaMinima: 0.6,
  criterios: [
    {
      criterio: 'pvp',
      peso: 20,
      valor: (s) => s.pvp,
      faixa: [
        [0.8, 100],
        [1, 60],
        [1.2, 10],
        [1.4, 0],
      ],
    },
    {
      criterio: 'dy12m',
      peso: 20,
      valor: (s) => s.dy12m,
      // DY alto demais costuma ser rendimento extraordinário ou fundo em crise
      faixa: [
        [4, 0],
        [8, 60],
        [11, 100],
        [16, 100],
        [22, 40],
      ],
    },
    {
      criterio: 'liquidez',
      peso: 10,
      valor: (s) => s.liquidezMedia,
      faixa: [
        [50_000, 0],
        [500_000, 50],
        [2_000_000, 80],
        [5_000_000, 100],
      ],
    },
    {
      criterio: 'taxa_administracao',
      peso: 10,
      valor: (s) => s.taxaAdministracao,
      faixa: [
        [0.5, 100],
        [1, 60],
        [1.5, 20],
        [2, 0],
      ],
    },
    {
      criterio: 'alavancagem',
      peso: 10,
      valor: (s) => s.alavancagem,
      faixa: [
        [5, 100],
        [15, 60],
        [30, 0],
      ],
    },
    {
      criterio: 'vacancia',
      peso: 10,
      valor: (s) => s.vacancia,
      faixa: [
        [3, 100],
        [10, 60],
        [25, 0],
      ],
    },
    {
      criterio: 'diversificado',
      peso: 10,
      valor: (s) => s.diversificado,
    },
    {
      criterio: 'limite_distribuicao',
      peso: 5,
      valor: (s) => s.limiteDistribuicao,
    },
    {
      criterio: 'estabilidade_dividendos',
      peso: 5,
      valor: (s) => s.variacaoDividendos,
      faixa: [
        [0.1, 100],
        [0.3, 50],
        [0.6, 0],
      ],
    },
  ],
}

/**
 * Score de FII v0: só DY 12m e P/VP (a regra "barato e pagando bem"), para
 * comparar com a v1
 */
export const FII_SCORE_V0_DY_PVP: ScoreConfig<FiiSnapshot> = {
  versao: 'fii-v0-dy-pvp',
  descricao: 'DY 12m e P/VP',
  coberturaMinima: 1,
  criterios: [FII_SCORE_V1.criterios[0], FII_SCORE_V1.criterios[1]],
}

/** Versões de score de FII disponíveis */
export const FII_SCORES: Record<string, ScoreConfig<FiiSnapshot>> = {
  [FII_SCORE_V1.versao]: FII_SCORE_V1,
  [FII_SCORE_V0_DY_PVP.versao]: FII_SCORE_V0_DY_PVP,
}

/** Pontuação de FIIs */
export class FiiScorer extends Scorer<FiiSnapshot> {
  /**
   * Instancia o score da versão
   *
   * @throws Error se a versão não existir
   */
  static versao(versao: string): FiiScorer {
    const config = FII_SCORES[versao]
    // Se a versão não existe
    if (!config) {
      throw new Error(
        `versão de score desconhecida: ${versao} (disponíveis: ${Object.keys(FII_SCORES).join(', ')})`,
      )
    }
    return new FiiScorer(config)
  }
}
