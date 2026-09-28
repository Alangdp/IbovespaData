import type { Database } from 'bun:sqlite'

import type { Dataset, ValorDataset } from './dataset.js'

/** Metadados de um dataset gravado (reprodutibilidade) */
export interface MetaDataset {
  tabela: string
  criadoEm: string
  /** Commit do código que montou o dataset */
  codigoVersao: string
  /** Estado da base de dados usada */
  dadosVersao: string
  /** Opções da montagem (frequência, horizontes, scores) */
  opcoes: unknown
  linhas: number
}

/** Tipo SQLite de cada tipo de coluna */
const TIPO_SQL = { numero: 'REAL', texto: 'TEXT', booleano: 'INTEGER' } as const

/** Converte o valor para gravar (booleano vira 0/1) */
function paraSql(valor: ValorDataset): number | string | null {
  return typeof valor === 'boolean' ? (valor ? 1 : 0) : valor
}

/** Escapa um valor para CSV (separador vírgula, decimal ponto) */
function paraCsv(valor: unknown): string {
  // Se é vazio
  if (valor === null || valor === undefined) {
    return ''
  }
  const texto = String(valor)
  return /[",\n\r]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto
}

/** Gravação, leitura e exportação dos datasets */
export class DatasetStore {
  constructor(private readonly db: Database) {
    this.db.exec(`CREATE TABLE IF NOT EXISTS dataset_meta (
      tabela TEXT PRIMARY KEY,
      criado_em TEXT NOT NULL,
      codigo_versao TEXT NOT NULL,
      dados_versao TEXT NOT NULL,
      opcoes TEXT NOT NULL,
      colunas TEXT NOT NULL,
      linhas INTEGER NOT NULL
    ) WITHOUT ROWID`)
  }

  /**
   * Grava o dataset numa tabela própria, substituindo a anterior
   *
   * @param tabela - Nome da tabela (ex.: `dataset_fii`)
   */
  salvar(
    tabela: string,
    dataset: Dataset,
    meta: Omit<MetaDataset, 'tabela' | 'criadoEm' | 'linhas'>,
  ) {
    // Valida o nome da tabela (vai direto no SQL)
    if (!/^[a-z_][a-z0-9_]*$/.test(tabela)) {
      throw new Error(`nome de tabela inválido: ${tabela}`)
    }
    const colunas = dataset.colunas
    const definicao = colunas
      .map((c) => `"${c.nome}" ${TIPO_SQL[c.tipo]}`)
      .join(', ')

    // Recria a tabela e grava as linhas e os metadados numa transação só
    this.db.transaction(() => {
      this.db.exec(`DROP TABLE IF EXISTS ${tabela}`)
      this.db.exec(`CREATE TABLE ${tabela} (${definicao})`)
      this.db.exec(`CREATE INDEX ${tabela}_data ON ${tabela} (data, ativo_id)`)
      this.db.exec(`CREATE INDEX ${tabela}_ativo ON ${tabela} (ativo_id, data)`)
      const insert = this.db.prepare(
        `INSERT INTO ${tabela} VALUES (${colunas.map(() => '?').join(', ')})`,
      )
      for (const linha of dataset.linhas) {
        insert.run(...colunas.map((c) => paraSql(linha[c.nome] ?? null)))
      }
      this.db
        .prepare(
          `INSERT OR REPLACE INTO dataset_meta
           (tabela, criado_em, codigo_versao, dados_versao, opcoes, colunas, linhas)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          tabela,
          new Date().toISOString(),
          meta.codigoVersao,
          meta.dadosVersao,
          JSON.stringify(meta.opcoes),
          JSON.stringify(colunas),
          dataset.linhas.length,
        )
    })()
  }

  /** Metadados do dataset gravado; `null` se não existe */
  meta(tabela: string): MetaDataset | null {
    const row = this.db
      .prepare('SELECT * FROM dataset_meta WHERE tabela = ?')
      .get(tabela) as {
      tabela: string
      criado_em: string
      codigo_versao: string
      dados_versao: string
      opcoes: string
      linhas: number
    } | null
    return row
      ? {
          tabela: row.tabela,
          criadoEm: row.criado_em,
          codigoVersao: row.codigo_versao,
          dadosVersao: row.dados_versao,
          opcoes: JSON.parse(row.opcoes),
          linhas: row.linhas,
        }
      : null
  }

  /**
   * Exporta a tabela para CSV (vírgula, decimal com ponto, booleano 0/1,
   * vazio = sem dado), em pedaços para não montar o arquivo inteiro na
   * memória
   *
   * @returns Quantidade de linhas escritas
   */
  async exportarCsv(tabela: string, caminho: string): Promise<number> {
    // Se o dataset não existe
    if (!this.meta(tabela)) {
      throw new Error(`dataset ${tabela} não existe: rode o comando dataset`)
    }
    const consulta = this.db.prepare(
      `SELECT * FROM ${tabela} ORDER BY data, ticker`,
    )
    const writer = Bun.file(caminho).writer()
    let colunas: string[] | null = null
    let linhas = 0
    for (const row of consulta.iterate() as Iterable<Record<string, unknown>>) {
      // Escreve o cabeçalho com a primeira linha
      if (!colunas) {
        colunas = Object.keys(row)
        writer.write(`${colunas.join(',')}\n`)
      }
      writer.write(`${colunas.map((c) => paraCsv(row[c])).join(',')}\n`)
      linhas++
    }
    await writer.end()
    return linhas
  }

  /** Executa uma consulta de leitura no dataset (usada pela ficha) */
  consultar<T>(sql: string, ...parametros: (string | number)[]): T[] {
    return this.db.prepare(sql).all(...parametros) as T[]
  }
}
