import {
  COLUNAS_BASE,
  colunaScore,
  colunasRotulo,
  HORIZONTES_DATASET,
  LIQUIDEZ_MERCADO,
} from '../core/dataset.js'
import { dicionarioMarkdown } from '../core/features.js'
import { LIMITES_ALERTA } from './alertas.js'
import { FII_SCORES } from './FiiScorer.js'
import { FII_FEATURES } from './features.js'

/**
 * Gera o dicionário de dados do dataset de FII em Markdown
 * (`docs/backtest-dataset.md`), a partir do mesmo registro que monta o
 * dataset
 *
 * Um teste compara o arquivo com esta saída, então o documento não fica
 * desatualizado: ao mudar uma feature, rode
 * `bun run backtest dicionario --gravar`
 */
export function dicionarioDatasetFii(): string {
  const tabela = (
    colunas: { nome: string; tipo: string; descricao: string }[],
  ) => [
    '| Coluna | Tipo | Descrição |',
    '| --- | --- | --- |',
    ...colunas.map((c) => `| \`${c.nome}\` | ${c.tipo} | ${c.descricao} |`),
  ]

  const exemplo = HORIZONTES_DATASET[3]
  return [
    '# Dicionário do dataset de FII',
    '',
    '<!-- Gerado por `bun run backtest dicionario --gravar`; não edite à mão -->',
    '',
    'Uma linha por FII negociável em cada data de decisão (1º pregão do mês,',
    'ou da semana com `--frequencia semanal`). Tabela `dataset_fii` em',
    '`data/backtest.db` e CSV em `data/dataset_fii.csv` (vírgula, decimal com',
    'ponto, booleano 0/1, vazio = sem dado).',
    '',
    '- **Features** (entradas do modelo): só dados conhecidos ANTES da data.',
    '- **Scores**: o score de cada versão na data (também uma feature).',
    '- **Rótulos** (o que prever): o que aconteceu DEPOIS da data. Nunca use um',
    '  rótulo como entrada.',
    '',
    'Veja `docs/backtest.md` (seção "Dataset para IA") para como dividir',
    'treino e teste sem vazamento.',
    '',
    '## Colunas de identificação',
    '',
    ...tabela(COLUNAS_BASE),
    '',
    '## Features',
    '',
    dicionarioMarkdown(FII_FEATURES),
    '## Scores',
    '',
    ...tabela(
      Object.keys(FII_SCORES).flatMap((versao) => [
        {
          nome: colunaScore(versao),
          tipo: 'numero',
          descricao: `score ${versao} (0 a 100); vazio sem cobertura mínima`,
        },
        {
          nome: `${colunaScore(versao)}_posicao`,
          tipo: 'numero',
          descricao: `posição no ranking do ${versao} na data (1 = melhor)`,
        },
      ]),
    ),
    '',
    '## Rótulos',
    '',
    `Para cada horizonte H em dias (${HORIZONTES_DATASET.join(', ')}), as colunas`,
    `abaixo têm o sufixo \`_Hd\` (exemplo com ${exemplo}). Retornos em fração`,
    '(0,05 = 5%), com compra no fechamento da data (`preco_base`) e tudo na',
    'base de cotas da data (desdobramentos ajustados). O "mercado" é a média',
    `dos fundos com liquidez média >= R$ ${LIQUIDEZ_MERCADO.toLocaleString('pt-BR')} na mesma data.`,
    'Horizontes que ainda não terminaram na base ficam vazios.',
    '',
    ...tabela(colunasRotulo(exemplo)),
    '',
    '## Limites dos alertas',
    '',
    '| Limite | Valor |',
    '| --- | --- |',
    ...Object.entries(LIMITES_ALERTA).map(
      ([nome, valor]) => `| \`${nome}\` | ${valor} |`,
    ),
    '',
  ].join('\n')
}
