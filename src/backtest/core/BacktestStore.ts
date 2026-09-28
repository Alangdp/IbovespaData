import type { Database } from 'bun:sqlite'

import type { ResultadoBacktest } from './Backtest.js'

/**
 * Tabelas dos resultados
 *
 * As recomendações guardam o ativo (`ativo_id`, ISIN) e a data, o que permite
 * cruzar depois com a tabela `evento` (desdobramentos hoje; fatos relevantes
 * e notícias no futuro): recomendação -> período -> retorno -> eventos
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS backtest_execucao (
  id TEXT PRIMARY KEY,
  criado_em TEXT NOT NULL,
  grupo TEXT,
  nome TEXT,
  tipo_ativo TEXT NOT NULL,
  score_versao TEXT NOT NULL,
  benchmark TEXT NOT NULL,
  dados_versao TEXT NOT NULL,
  codigo_versao TEXT,
  score_config TEXT,
  inicio TEXT NOT NULL,
  fim TEXT NOT NULL,
  config TEXT NOT NULL,
  resumo TEXT NOT NULL,
  faixas TEXT NOT NULL,
  posicoes_finais TEXT NOT NULL,
  avisos TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS backtest_recomendacao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execucao_id TEXT NOT NULL,
  data TEXT NOT NULL,
  ativo_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  score REAL NOT NULL,
  cobertura REAL NOT NULL,
  posicao INTEGER NOT NULL,
  preco_referencia REAL NOT NULL,
  selecionado INTEGER NOT NULL,
  preco_compra REAL,
  quantidade REAL NOT NULL,
  valor_investido REAL NOT NULL,
  criterios TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS backtest_recomendacao_execucao
  ON backtest_recomendacao (execucao_id, data);
CREATE INDEX IF NOT EXISTS backtest_recomendacao_ativo
  ON backtest_recomendacao (ativo_id, data);
CREATE TABLE IF NOT EXISTS backtest_retorno (
  recomendacao_id INTEGER NOT NULL,
  horizonte TEXT NOT NULL,
  data_final TEXT NOT NULL,
  preco_final REAL NOT NULL,
  dividendos_por_cota REAL NOT NULL,
  retorno_preco REAL NOT NULL,
  retorno_dividendos REAL NOT NULL,
  retorno_total REAL NOT NULL,
  completo INTEGER NOT NULL,
  PRIMARY KEY (recomendacao_id, horizonte)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS backtest_operacao (
  execucao_id TEXT NOT NULL,
  data TEXT NOT NULL,
  ativo_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  tipo TEXT NOT NULL,
  quantidade REAL NOT NULL,
  preco REAL NOT NULL,
  valor REAL NOT NULL,
  custo REAL NOT NULL,
  ir REAL NOT NULL,
  motivo TEXT
);
CREATE INDEX IF NOT EXISTS backtest_operacao_execucao ON backtest_operacao (execucao_id);
CREATE TABLE IF NOT EXISTS backtest_dividendo (
  execucao_id TEXT NOT NULL,
  data_com TEXT NOT NULL,
  data_pagamento TEXT NOT NULL,
  ativo_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  quantidade REAL NOT NULL,
  valor_por_cota REAL NOT NULL,
  total REAL NOT NULL,
  fonte TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS backtest_dividendo_execucao ON backtest_dividendo (execucao_id);
CREATE TABLE IF NOT EXISTS backtest_carteira (
  execucao_id TEXT NOT NULL,
  data TEXT NOT NULL,
  aportado REAL NOT NULL,
  posicoes REAL NOT NULL,
  caixa REAL NOT NULL,
  patrimonio REAL NOT NULL,
  cota REAL NOT NULL,
  benchmark_patrimonio REAL NOT NULL,
  benchmark_cota REAL NOT NULL,
  cdi_dia REAL NOT NULL,
  PRIMARY KEY (execucao_id, data)
) WITHOUT ROWID;
`

/** Resumo de uma execução gravada */
export interface ExecucaoGravada {
  id: string
  criadoEm: string
  grupo: string | null
  nome: string | null
  tipoAtivo: string
  scoreVersao: string
  benchmark: string
  inicio: string
  fim: string
  resumo: ResultadoBacktest['resumo']
}

/** Gravação e leitura dos resultados das simulações */
export class BacktestStore {
  constructor(private readonly db: Database) {
    this.db.exec(SCHEMA)
    this.migrar()
  }

  /**
   * Grava o resultado completo da simulação
   *
   * @param grupo - Junta as execuções de uma mesma comparação
   */
  salvar(resultado: ResultadoBacktest, grupo: string | null = null) {
    const db = this.db
    const execucao = db.prepare(
      `INSERT INTO backtest_execucao (id, criado_em, grupo, nome, tipo_ativo,
         score_versao, benchmark, dados_versao, inicio, fim, config, resumo,
         faixas, posicoes_finais, avisos, codigo_versao, score_config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const recomendacao = db.prepare(
      `INSERT INTO backtest_recomendacao (execucao_id, data, ativo_id, ticker,
         score, cobertura, posicao, preco_referencia, selecionado, preco_compra,
         quantidade, valor_investido, criterios)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const retorno = db.prepare(
      `INSERT INTO backtest_retorno (recomendacao_id, horizonte, data_final,
         preco_final, dividendos_por_cota, retorno_preco, retorno_dividendos,
         retorno_total, completo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const operacao = db.prepare(
      `INSERT INTO backtest_operacao (execucao_id, data, ativo_id, ticker, tipo,
         quantidade, preco, valor, custo, ir, motivo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const dividendo = db.prepare(
      `INSERT INTO backtest_dividendo (execucao_id, data_com, data_pagamento,
         ativo_id, ticker, quantidade, valor_por_cota, total, fonte)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const ponto = db.prepare(
      `INSERT INTO backtest_carteira (execucao_id, data, aportado, posicoes,
         caixa, patrimonio, cota, benchmark_patrimonio, benchmark_cota, cdi_dia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const id = resultado.id

    db.transaction(() => {
      execucao.run(
        id,
        resultado.criadoEm,
        grupo,
        resultado.config.nome,
        resultado.tipoAtivo,
        resultado.scoreVersao,
        resultado.benchmarkNome,
        resultado.dadosVersao,
        resultado.config.inicio,
        resultado.config.fim,
        JSON.stringify(resultado.config),
        JSON.stringify(resultado.resumo),
        JSON.stringify(resultado.faixas),
        JSON.stringify(resultado.posicoesFinais),
        JSON.stringify(resultado.avisos),
        resultado.codigoVersao,
        JSON.stringify(resultado.scoreConfig),
      )

      // Grava cada recomendação e o retorno dela em cada horizonte
      for (const item of resultado.recomendacoes) {
        const { lastInsertRowid } = recomendacao.run(
          id,
          item.data,
          item.ativoId,
          item.ticker,
          item.score,
          item.cobertura,
          item.posicao,
          item.precoReferencia,
          item.selecionado ? 1 : 0,
          item.precoCompra,
          item.quantidade,
          item.valorInvestido,
          JSON.stringify(item.criterios),
        )
        for (const r of item.retornos) {
          retorno.run(
            lastInsertRowid,
            r.horizonte === null ? 'fim' : String(r.horizonte),
            r.dataFinal,
            r.precoFinal,
            r.dividendosPorCota,
            r.retornoPreco,
            r.retornoDividendos,
            r.retornoTotal,
            r.completo ? 1 : 0,
          )
        }
      }

      for (const op of resultado.operacoes) {
        operacao.run(
          id,
          op.data,
          op.ativoId,
          op.ticker,
          op.tipo,
          op.quantidade,
          op.preco,
          op.valor,
          op.custo,
          op.ir,
          op.motivo ?? null,
        )
      }
      for (const d of resultado.dividendos) {
        dividendo.run(
          id,
          d.dataCom,
          d.dataPagamento,
          d.ativoId,
          d.ticker,
          d.quantidade,
          d.valorPorCota,
          d.total,
          d.fonte,
        )
      }
      for (const p of resultado.carteira) {
        ponto.run(
          id,
          p.data,
          p.aportado,
          p.posicoes,
          p.caixa,
          p.patrimonio,
          p.cota,
          p.benchmarkPatrimonio,
          p.benchmarkCota,
          p.cdiDia,
        )
      }
    })()
  }

  /**
   * Adiciona as colunas criadas depois da primeira versão da tabela (bases
   * antigas não passam pelo CREATE TABLE de novo)
   */
  private migrar() {
    const colunas = new Set(
      (
        this.db.prepare('PRAGMA table_info(backtest_execucao)').all() as {
          name: string
        }[]
      ).map((coluna) => coluna.name),
    )
    for (const coluna of ['codigo_versao', 'score_config']) {
      // Se a coluna ainda não existe
      if (!colunas.has(coluna)) {
        this.db.exec(`ALTER TABLE backtest_execucao ADD COLUMN ${coluna} TEXT`)
      }
    }
  }

  /** Lista as execuções gravadas, da mais recente para a mais antiga */
  listar(): ExecucaoGravada[] {
    const rows = this.db
      .prepare(
        `SELECT id, criado_em, grupo, nome, tipo_ativo, score_versao, benchmark,
           inicio, fim, resumo
         FROM backtest_execucao ORDER BY criado_em DESC`,
      )
      .all() as {
      id: string
      criado_em: string
      grupo: string | null
      nome: string | null
      tipo_ativo: string
      score_versao: string
      benchmark: string
      inicio: string
      fim: string
      resumo: string
    }[]
    return rows.map((row) => ({
      id: row.id,
      criadoEm: row.criado_em,
      grupo: row.grupo,
      nome: row.nome,
      tipoAtivo: row.tipo_ativo,
      scoreVersao: row.score_versao,
      benchmark: row.benchmark,
      inicio: row.inicio,
      fim: row.fim,
      resumo: JSON.parse(row.resumo),
    }))
  }
}
