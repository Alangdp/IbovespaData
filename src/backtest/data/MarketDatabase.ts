import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/** Caminho padrão da base do backtest (fora do git) */
export const DEFAULT_DB_PATH = process.env.BACKTEST_DB ?? 'data/backtest.db'

/**
 * Tabelas da base histórica
 *
 * - ativo: um por ISIN, com o ticker mais recente e o código BDI da B3
 * - preco: fechamento e volume de cada pregão (COTAHIST, sem ajuste)
 * - provento: rendimentos por cota na base da data-com
 * - evento: desdobramentos, grupamentos e, no futuro, fatos relevantes e
 *   notícias
 * - cdi: taxa diária (BCB SGS 12)
 * - cvm_linha: linhas dos informes da CVM com a data de entrega, para montar
 *   o fundo como era conhecido em cada data
 * - macro: séries macroeconômicas (Selic, IPCA, juro real) com a data em que
 *   cada valor passou a ser conhecido
 * - ingestao: controle do que já foi baixado
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS ativo (
  ativo_id TEXT PRIMARY KEY,
  ticker TEXT NOT NULL,
  codbdi TEXT NOT NULL,
  nome TEXT,
  primeira_data TEXT NOT NULL,
  ultima_data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS preco (
  ativo_id TEXT NOT NULL,
  data TEXT NOT NULL,
  ticker TEXT NOT NULL,
  fechamento REAL NOT NULL,
  volume REAL NOT NULL,
  negocios INTEGER NOT NULL,
  PRIMARY KEY (ativo_id, data)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS provento (
  ativo_id TEXT NOT NULL,
  data_com TEXT NOT NULL,
  data_pagamento TEXT NOT NULL,
  valor REAL NOT NULL,
  tipo TEXT NOT NULL,
  fonte TEXT NOT NULL,
  PRIMARY KEY (ativo_id, data_com, data_pagamento, tipo, fonte)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS evento (
  ativo_id TEXT NOT NULL,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL,
  fator REAL,
  descricao TEXT,
  fonte TEXT NOT NULL,
  PRIMARY KEY (ativo_id, data, tipo)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS cdi (
  data TEXT PRIMARY KEY,
  taxa REAL NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS cvm_linha (
  cnpj TEXT NOT NULL,
  arquivo TEXT NOT NULL,
  data_referencia TEXT NOT NULL,
  versao INTEGER NOT NULL,
  data_entrega TEXT NOT NULL,
  dados TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cvm_linha_cnpj ON cvm_linha (cnpj);
CREATE INDEX IF NOT EXISTS cvm_linha_arquivo_ano ON cvm_linha (arquivo, data_referencia);
CREATE TABLE IF NOT EXISTS macro (
  serie TEXT NOT NULL,
  data TEXT NOT NULL,
  valor REAL NOT NULL,
  conhecido_em TEXT NOT NULL,
  PRIMARY KEY (serie, data)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS ingestao (
  chave TEXT PRIMARY KEY,
  valor TEXT,
  atualizado_em TEXT NOT NULL
) WITHOUT ROWID;
`

/** Linha de preço para gravar */
export interface PrecoLinha {
  ativoId: string
  data: string
  ticker: string
  codbdi: string
  nome: string
  fechamento: number
  volume: number
  negocios: number
}

/** Provento para gravar */
export interface ProventoLinha {
  ativoId: string
  dataCom: string
  dataPagamento: string
  valor: number
  tipo: string
  fonte: string
}

/** Evento para gravar */
export interface EventoLinha {
  ativoId: string
  data: string
  tipo: string
  fator: number | null
  descricao: string | null
  fonte: string
}

/** Valor de uma série macroeconômica */
export interface MacroLinha {
  serie: string
  /** Data de referência (dia, ou 1º dia do mês nas séries mensais) */
  data: string
  valor: number
  /** Data em que o valor passou a ser público */
  conhecidoEm: string
}

/** Linha de informe da CVM para gravar */
export interface CvmLinha {
  cnpj: string
  arquivo: string
  dataReferencia: string
  versao: number
  dataEntrega: string
  dados: Record<string, string>
}

/**
 * Base SQLite com os dados históricos de mercado (preços, proventos, eventos,
 * CDI e informes da CVM)
 */
export class MarketDatabase {
  readonly db: Database

  /** @param path - Arquivo da base; `:memory:` para testes */
  constructor(path = DEFAULT_DB_PATH) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true })
    }
    this.db = new Database(path, { create: true })
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')
    this.db.exec(SCHEMA)
  }

  /**
   * Grava as cotações e atualiza os ativos
   *
   * Se o ativo tem mais de um ticker negociado no mesmo dia, fica o de maior
   * volume
   */
  inserirPrecos(linhas: PrecoLinha[]) {
    const preco = this.db.prepare(
      `INSERT INTO preco (ativo_id, data, ticker, fechamento, volume, negocios)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (ativo_id, data) DO UPDATE SET
         ticker = excluded.ticker, fechamento = excluded.fechamento,
         volume = excluded.volume, negocios = excluded.negocios
       WHERE excluded.volume > preco.volume`,
    )
    const ativo = this.db.prepare(
      `INSERT INTO ativo (ativo_id, ticker, codbdi, nome, primeira_data, ultima_data)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (ativo_id) DO UPDATE SET
         ticker = CASE WHEN excluded.ultima_data >= ativo.ultima_data
           THEN excluded.ticker ELSE ativo.ticker END,
         nome = CASE WHEN excluded.ultima_data >= ativo.ultima_data
           THEN excluded.nome ELSE ativo.nome END,
         primeira_data = min(ativo.primeira_data, excluded.primeira_data),
         ultima_data = max(ativo.ultima_data, excluded.ultima_data)`,
    )
    this.db.transaction(() => {
      for (const linha of linhas) {
        preco.run(
          linha.ativoId,
          linha.data,
          linha.ticker,
          linha.fechamento,
          linha.volume,
          linha.negocios,
        )
        ativo.run(
          linha.ativoId,
          linha.ticker,
          linha.codbdi,
          linha.nome,
          linha.data,
          linha.data,
        )
      }
    })()
  }

  /** Substitui os proventos de uma fonte para os ativos informados */
  substituirProventos(
    fonte: string,
    ativos: string[],
    linhas: ProventoLinha[],
  ) {
    const apagar = this.db.prepare(
      'DELETE FROM provento WHERE fonte = ? AND ativo_id = ?',
    )
    const inserir = this.db.prepare(
      `INSERT OR REPLACE INTO provento
       (ativo_id, data_com, data_pagamento, valor, tipo, fonte)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    this.db.transaction(() => {
      for (const ativoId of ativos) {
        apagar.run(fonte, ativoId)
      }
      for (const linha of linhas) {
        inserir.run(
          linha.ativoId,
          linha.dataCom,
          linha.dataPagamento,
          linha.valor,
          linha.tipo,
          linha.fonte,
        )
      }
    })()
  }

  /**
   * Substitui os eventos de uma fonte
   *
   * @param ativos - Só apaga os eventos destes ativos; sem eles, apaga todos
   * os da fonte
   */
  substituirEventos(fonte: string, linhas: EventoLinha[], ativos?: string[]) {
    const inserir = this.db.prepare(
      `INSERT OR REPLACE INTO evento (ativo_id, data, tipo, fator, descricao, fonte)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    this.db.transaction(() => {
      // Apaga os eventos antigos da fonte (de todos ou dos ativos informados)
      if (ativos) {
        const apagar = this.db.prepare(
          'DELETE FROM evento WHERE fonte = ? AND ativo_id = ?',
        )
        for (const ativoId of ativos) {
          apagar.run(fonte, ativoId)
        }
      } else {
        this.db.prepare('DELETE FROM evento WHERE fonte = ?').run(fonte)
      }
      for (const linha of linhas) {
        inserir.run(
          linha.ativoId,
          linha.data,
          linha.tipo,
          linha.fator,
          linha.descricao,
          linha.fonte,
        )
      }
    })()
  }

  /** Grava valores de séries macroeconômicas */
  inserirMacro(linhas: MacroLinha[]) {
    const inserir = this.db.prepare(
      `INSERT OR REPLACE INTO macro (serie, data, valor, conhecido_em)
       VALUES (?, ?, ?, ?)`,
    )
    this.db.transaction(() => {
      for (const linha of linhas) {
        inserir.run(linha.serie, linha.data, linha.valor, linha.conhecidoEm)
      }
    })()
  }

  /** Grava a taxa do CDI de cada dia */
  inserirCdi(taxas: { data: string; taxa: number }[]) {
    const inserir = this.db.prepare(
      'INSERT OR REPLACE INTO cdi (data, taxa) VALUES (?, ?)',
    )
    this.db.transaction(() => {
      for (const { data, taxa } of taxas) {
        inserir.run(data, taxa)
      }
    })()
  }

  /** Substitui as linhas de um arquivo da CVM em um ano de referência */
  substituirCvm(arquivo: string, ano: number, linhas: CvmLinha[]) {
    const inserir = this.db.prepare(
      `INSERT INTO cvm_linha (cnpj, arquivo, data_referencia, versao, data_entrega, dados)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    this.db.transaction(() => {
      this.db
        .prepare(
          'DELETE FROM cvm_linha WHERE arquivo = ? AND data_referencia LIKE ?',
        )
        .run(arquivo, `${ano}-%`)
      for (const linha of linhas) {
        inserir.run(
          linha.cnpj,
          linha.arquivo,
          linha.dataReferencia,
          linha.versao,
          linha.dataEntrega,
          JSON.stringify(linha.dados),
        )
      }
    })()
  }

  /** Lê um valor de controle da ingestão */
  lerControle(chave: string): string | null {
    const row = this.db
      .prepare('SELECT valor FROM ingestao WHERE chave = ?')
      .get(chave) as { valor: string | null } | null
    return row?.valor ?? null
  }

  /** Verifica se a chave de controle foi gravada hoje (data local) */
  atualizadoHoje(chave: string): boolean {
    const row = this.db
      .prepare('SELECT atualizado_em FROM ingestao WHERE chave = ?')
      .get(chave) as { atualizado_em: string } | null
    // Se a chave nunca foi gravada
    if (!row) {
      return false
    }
    return (
      new Date(row.atualizado_em).toLocaleDateString() ===
      new Date().toLocaleDateString()
    )
  }

  /** Grava um valor de controle da ingestão */
  gravarControle(chave: string, valor: string) {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO ingestao (chave, valor, atualizado_em) VALUES (?, ?, ?)',
      )
      .run(chave, valor, new Date().toISOString())
  }

  fechar() {
    this.db.close()
  }
}
