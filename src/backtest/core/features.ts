/**
 * Descrição das features de um tipo de ativo: o que é cada coluna do dataset,
 * de onde vem e quando fica conhecida
 *
 * O mesmo registro monta o dataset e gera o dicionário de dados da
 * documentação (`bun run backtest dicionario`), então os dois nunca divergem
 */

/** Tipo do valor de uma feature */
export type TipoFeature = 'numero' | 'booleano' | 'texto'

/** Uma feature (coluna) do dataset */
export interface FeatureDef<TSnapshot> {
  /** Nome da coluna (snake_case) */
  nome: string
  /** Agrupamento na documentação (mercado, proventos, fundamentos...) */
  grupo: string
  descricao: string
  tipo: TipoFeature
  /** Unidade (%, R$, dias...); vazio quando não se aplica */
  unidade: string
  /** Fonte do dado */
  fonte: string
  /** Quando o valor passa a ser conhecido (a regra que evita look-ahead) */
  conhecido: string
  valor: (snapshot: TSnapshot) => number | boolean | string | null
}

/** Monta o dicionário das features em Markdown, agrupado */
export function dicionarioMarkdown<T>(features: FeatureDef<T>[]): string {
  const grupos = new Map<string, FeatureDef<T>[]>()
  for (const feature of features) {
    const lista = grupos.get(feature.grupo) ?? []
    lista.push(feature)
    grupos.set(feature.grupo, lista)
  }

  const linhas: string[] = []
  for (const [grupo, lista] of grupos) {
    linhas.push(`### ${grupo}`, '')
    linhas.push(
      '| Coluna | Tipo | Unidade | Descrição | Fonte | Conhecida em |',
    )
    linhas.push('| --- | --- | --- | --- | --- | --- |')
    for (const f of lista) {
      linhas.push(
        `| \`${f.nome}\` | ${f.tipo} | ${f.unidade || '-'} | ${f.descricao} | ${f.fonte} | ${f.conhecido} |`,
      )
    }
    linhas.push('')
  }
  return linhas.join('\n')
}
