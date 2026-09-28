// Backtest de FIIs: ingestão da base histórica e simulações
//   bun scripts/backtest.ts simular [config.json] [--tickers XPML11] [--inicial 10000] [--mensal 500]
//     [--cotas XPML11:100] [--score v] [--scores v1,v2] [--force]
//     atualiza a base (só os tickers da configuração, se houver) e simula; sem
//     arquivo usa scripts/backtest.exemplo.json; --tickers restringe a seleção
//   bun scripts/backtest.ts ingest [--tickers GGRC11,HGLG11] [--desde 2016] [--extras XFIX11] [--sem-proventos] [--force]
//   bun scripts/backtest.ts run [config.json] (mesmas opções de simulação do simular)
//   bun scripts/backtest.ts compare <config.json> --scores fii-v1,fii-v0-dy-pvp
//   bun scripts/backtest.ts list
//   bun scripts/backtest.ts dataset [--frequencia semanal] [--scores v1,v2] [--inicio] [--fim] [--csv caminho | --sem-csv]
//   bun scripts/backtest.ts ficha TICKER [--data AAAA-MM-DD] [--score v] [--json]
//   bun scripts/backtest.ts robustez [config.json] [--passo 3] [--scores v1,v2] [--csv caminho]
//   bun scripts/backtest.ts dicionario [--gravar | --saida arquivo.md]
// Documentação completa: docs/backtest.md. A base fica em data/backtest.db (ou BACKTEST_DB)
import type { ResultadoBacktest } from '../src/backtest/core/Backtest'
import { BacktestStore } from '../src/backtest/core/BacktestStore'
import { DatasetStore } from '../src/backtest/core/DatasetStore'
import { HORIZONTES_DATASET, montarDataset } from '../src/backtest/core/dataset'
import { addDays } from '../src/backtest/core/dates'
import { type Ficha, montarFicha } from '../src/backtest/core/ficha'
import { executarRobustez } from '../src/backtest/core/robustez'
import type { BacktestConfig, Metricas } from '../src/backtest/core/types'
import { versaoCodigo } from '../src/backtest/core/versao'
import { MarketDatabase } from '../src/backtest/data/MarketDatabase'
import { ingerirMacro } from '../src/backtest/data/macro'
import { alertasFii } from '../src/backtest/fii/alertas'
import { dicionarioDatasetFii } from '../src/backtest/fii/dicionario'
import { FiiBacktest } from '../src/backtest/fii/FiiBacktest'
import { FiiHistoricalProvider } from '../src/backtest/fii/FiiHistoricalProvider'
import { FiiScorer } from '../src/backtest/fii/FiiScorer'
import { FII_FEATURES } from '../src/backtest/fii/features'
import {
  detectarDesdobramentos,
  estimarProventosCvm,
  ingerirCdi,
  ingerirCotacoes,
  ingerirCvm,
  ingerirProventos,
} from '../src/backtest/fii/ingest'

const [comando, ...args] = process.argv.slice(2)

/** Valor de uma opção `--nome valor` */
function opcao(nome: string): string | undefined {
  const indice = args.indexOf(`--${nome}`)
  return indice >= 0 ? args[indice + 1] : undefined
}

const log = (mensagem: string) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${mensagem}`)

/** Formata uma fração como percentual */
function pct(valor: number | null): string {
  return valor === null ? '-' : `${(valor * 100).toFixed(2)}%`
}

/** Formata um valor em reais */
function brl(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Formata um número com 2 casas */
function num(valor: number | null): string {
  return valor === null ? '-' : valor.toFixed(2)
}

/** Linhas de métricas para a tabela do resumo */
function linhasMetricas(m: Metricas) {
  return {
    Aportado: brl(m.aportado),
    'Patrimônio final': brl(m.patrimonioFinal),
    'Retorno acumulado': pct(m.retornoAcumulado),
    'Retorno da cota': pct(m.retornoCota),
    CAGR: pct(m.cagr),
    TIR: pct(m.tir),
    'Drawdown máximo': pct(m.drawdownMaximo),
    Volatilidade: pct(m.volatilidade),
    Sharpe: num(m.sharpe),
    Sortino: num(m.sortino),
  }
}

/** Mostra o resumo de uma ou mais execuções lado a lado */
function mostrar(resultados: ResultadoBacktest[]) {
  const primeiro = resultados[0]
  const config = primeiro.config
  console.log(
    `\nPeríodo ${config.inicio} a ${config.fim} | benchmark ${primeiro.benchmarkNome}`,
  )

  // Mostra como o dinheiro entrou: saldo e cotas iniciais e o aporte
  const cotasIniciais = primeiro.operacoes
    .filter((op) => op.tipo === 'posicao_inicial')
    .map(
      (op) =>
        `${op.quantidade} ${op.ticker} a ${brl(op.preco)} (${brl(op.valor)})`,
    )
  console.log(
    [
      `Saldo inicial ${brl(config.saldoInicial)}`,
      `cotas iniciais: ${cotasIniciais.join(', ') || 'nenhuma'}`,
      `aporte ${config.aporte.frequencia} de ${brl(config.aporte.valor)}`,
    ].join(' | '),
  )
  for (const aviso of primeiro.avisos) {
    console.log(`aviso: ${aviso}`)
  }

  // Monta a tabela: uma coluna por score e uma para o benchmark
  const tabela: Record<string, Record<string, string>> = {}
  for (const r of resultados) {
    const e = r.resumo.estrategia
    tabela[r.scoreVersao] = {
      ...linhasMetricas(e),
      Valorização: brl(e.valorizacao),
      'Dividendos recebidos': brl(e.dividendosRecebidos),
      'Dividendos reinvestidos': brl(e.dividendosReinvestidos),
      'IR pago': brl(e.irPago),
      'Excesso de CAGR': pct(r.resumo.excessoCagr),
      'Excesso de patrimônio': brl(r.resumo.excessoPatrimonio),
    }
  }
  tabela[primeiro.benchmarkNome] = linhasMetricas(primeiro.resumo.benchmark)
  console.table(tabela)

  // Mostra o retorno por faixa de score em 1 ano
  for (const r of resultados) {
    const faixas = r.faixas.filter((faixa) => faixa.horizonte === 365)
    if (faixas.length === 0) {
      continue
    }
    console.log(`\nRetorno em 1 ano por faixa de score (${r.scoreVersao})`)
    console.table(
      Object.fromEntries(
        faixas.map((f) => [
          f.faixa,
          {
            Observações: f.observacoes,
            'Retorno médio': pct(f.retornoMedio),
            Mediana: pct(f.retornoMediano),
            Acerto: pct(f.acerto),
            'Excesso vs média': pct(f.excessoMedio),
          },
        ]),
      ),
    )
  }
  console.log(`\nexecuções gravadas: ${resultados.map((r) => r.id).join(', ')}`)
}

/** Opções que recebem um valor (o valor não é o arquivo de configuração) */
const OPCOES_COM_VALOR = new Set([
  'score',
  'scores',
  'tickers',
  'desde',
  'extras',
  'inicial',
  'mensal',
  'cotas',
  'data',
  'frequencia',
  'passo',
  'csv',
  'saida',
  'inicio',
  'fim',
])

/**
 * Valor numérico de uma opção (aceita vírgula decimal)
 *
 * @throws Error se o valor não for um número maior ou igual a zero
 */
function opcaoNumero(nome: string): number | undefined {
  const texto = opcao(nome)
  // Se a opção não foi informada
  if (texto === undefined) {
    return undefined
  }
  const valor = Number(texto.replace(',', '.'))
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error(`--${nome} precisa ser um número >= 0 (recebido: ${texto})`)
  }
  return valor
}

/**
 * Cotas iniciais de `--cotas XPML11:100,HGLG11:50`
 *
 * @throws Error se algum item não for TICKER:QUANTIDADE
 */
function cotasDaOpcao(): { ticker: string; quantidade: number }[] | undefined {
  const itens = lista('cotas')
  // Se a opção não foi informada
  if (itens.length === 0) {
    return undefined
  }
  return itens.map((item) => {
    const [ticker, quantidade] = item.split(':')
    const numero = Number(quantidade)
    if (!ticker || !Number.isInteger(numero) || numero <= 0) {
      throw new Error(
        `--cotas espera TICKER:QUANTIDADE (ex.: XPML11:100), recebido: ${item}`,
      )
    }
    return { ticker, quantidade: numero }
  })
}

/** Configuração usada quando nenhum arquivo é informado */
const CONFIG_PADRAO = 'scripts/backtest.exemplo.json'

/** Primeiro argumento que não é opção nem valor de opção */
function argumentoPosicional(): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      // Pula o valor da opção
      if (OPCOES_COM_VALOR.has(args[i].slice(2))) {
        i++
      }
      continue
    }
    return args[i]
  }
  return undefined
}

/**
 * Carrega a configuração da simulação: o arquivo informado ou, sem ele, a
 * configuração padrão
 *
 * Com `--tickers`, a seleção fica restrita a esses fundos (sem o filtro de
 * liquidez, que continua valendo para o benchmark universo)
 */
async function carregarConfig(): Promise<BacktestConfig> {
  const arquivo = argumentoPosicional() ?? CONFIG_PADRAO
  const file = Bun.file(arquivo)
  // Se o arquivo não existe
  if (!(await file.exists())) {
    throw new Error(
      `arquivo de configuração não encontrado: ${arquivo} (crie um copiando ${CONFIG_PADRAO}, ou use --tickers XPML11 sem arquivo)`,
    )
  }
  const config = (await file.json()) as BacktestConfig

  // Se os tickers vieram na linha de comando, substituem os do arquivo
  const tickers = lista('tickers')
  if (tickers.length > 0) {
    config.nome = `Aportes em ${tickers.join(', ')}`
    config.selecao = {
      ...config.selecao,
      tickers,
      quantidade: Math.min(config.selecao.quantidade, tickers.length),
    }
  }

  // Substitui o saldo inicial, o aporte mensal e as cotas iniciais, se vieram
  // na linha de comando (--mensal troca a frequência para mensal)
  const inicial = opcaoNumero('inicial')
  if (inicial !== undefined) {
    config.saldoInicial = inicial
  }
  const mensal = opcaoNumero('mensal')
  if (mensal !== undefined) {
    config.aporte = { ...config.aporte, valor: mensal, frequencia: 'mensal' }
  }
  const cotas = cotasDaOpcao()
  if (cotas) {
    config.cotasIniciais = cotas
  }
  return config
}

/** Lista separada por vírgula de uma opção */
function lista(nome: string): string[] {
  return (opcao(nome) ?? '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
}

/**
 * Atualiza a base histórica
 *
 * Cotações e CVM são por ano (a B3 e a CVM só publicam o arquivo com todos os
 * fundos), mas só baixam o que mudou; proventos e desdobramentos, que são a
 * parte lenta, ficam restritos aos tickers pedidos
 *
 * @param tickers - Fundos a atualizar; vazio = todos
 * @param extras - Tickers de fora dos FIIs a baixar (ex.: ETF de benchmark)
 */
async function atualizarBase(
  db: MarketDatabase,
  tickers: string[],
  extras: string[],
  force: boolean,
) {
  const desde = Number(opcao('desde') ?? 2016)
  const anos = Array.from(
    { length: new Date().getFullYear() - desde + 1 },
    (_, i) => desde + i,
  )
  const inicio = Date.now()
  log(
    tickers.length
      ? `atualizando a base para ${tickers.join(', ')}`
      : 'atualizando a base (todos os FIIs)',
  )

  // Se algum ticker extra ainda não está na base, baixa as cotações de novo
  // (os anos já baixados não teriam o ticker)
  const extraNovo = extras.some(
    (ticker) =>
      !db.db
        .prepare('SELECT 1 FROM preco WHERE ticker = ? LIMIT 1')
        .get(ticker),
  )
  await ingerirCotacoes(db, anos, extras, log, force || extraNovo)
  await ingerirCdi(db, anos, log, force)
  await ingerirMacro(db, anos, log, force)
  await ingerirCvm(db, anos, log, force)
  if (!args.includes('--sem-proventos')) {
    await ingerirProventos(db, log, force, tickers)
  }
  estimarProventosCvm(db, log, tickers)
  detectarDesdobramentos(db, log, tickers)
  log(`base atualizada em ${((Date.now() - inicio) / 1000).toFixed(1)}s`)
}

/** Executa a simulação com cada versão de score, grava e mostra */
function simular(
  db: MarketDatabase,
  config: BacktestConfig,
  versoes: string[],
) {
  log('carregando a base')
  const backtest = new FiiBacktest(new FiiHistoricalProvider(db))
  log(`simulando: ${versoes.join(', ')}`)
  const resultados = backtest.comparar(config, versoes)

  // Grava os resultados (a comparação fica no mesmo grupo)
  const store = new BacktestStore(db.db)
  const grupo = resultados.length > 1 ? crypto.randomUUID() : null
  for (const resultado of resultados) {
    store.salvar(resultado, grupo)
  }
  mostrar(resultados)
}

/** Tabela do dataset de FII */
const TABELA_DATASET = 'dataset_fii'

/** CSV padrão do dataset */
const CSV_DATASET = 'data/dataset_fii.csv'

/** Dicionário de dados do dataset (gerado) */
const DOC_DICIONARIO = 'docs/backtest-dataset.md'

/**
 * Monta o dataset de features e rótulos, grava na base e exporta o CSV
 */
async function comandoDataset(db: MarketDatabase) {
  log('carregando a base')
  const provider = new FiiHistoricalProvider(db)
  const scores = opcao('scores')?.split(',') ?? ['fii-v1', 'fii-v0-dy-pvp']
  const frequencia = opcao('frequencia') === 'semanal' ? 'semanal' : 'mensal'
  const opcoes = {
    inicio: opcao('inicio'),
    fim: opcao('fim'),
    frequencia,
    horizontes: HORIZONTES_DATASET,
    scores,
  } as const

  // Monta o dataset mostrando o avanço a cada ano
  log(`montando o dataset (${frequencia}, scores ${scores.join(', ')})`)
  let ano = ''
  const dataset = montarDataset(
    provider,
    FII_FEATURES,
    {
      ...opcoes,
      scorers: scores.map((versao) => FiiScorer.versao(versao)),
    },
    (data, linhas) => {
      if (data.slice(0, 4) !== ano) {
        ano = data.slice(0, 4)
        log(`  ${ano}... (${linhas} linhas até agora)`)
      }
    },
  )

  // Grava na base e exporta o CSV
  const store = new DatasetStore(db.db)
  store.salvar(TABELA_DATASET, dataset, {
    codigoVersao: versaoCodigo(),
    dadosVersao: provider.versaoDados(),
    opcoes,
  })
  log(
    `dataset gravado na tabela ${TABELA_DATASET}: ${dataset.linhas.length} linhas, ${dataset.colunas.length} colunas`,
  )
  if (!args.includes('--sem-csv')) {
    const caminho = opcao('csv') ?? CSV_DATASET
    const linhas = await store.exportarCsv(TABELA_DATASET, caminho)
    log(`CSV exportado: ${caminho} (${linhas} linhas)`)
  }
}

/** Formata um valor da ficha com a unidade */
function valorFicha(valor: unknown, unidade: string): string {
  // Se não há dado
  if (valor === null || valor === undefined || valor === '') {
    return '-'
  }
  if (typeof valor === 'boolean') {
    return valor ? 'sim' : 'não'
  }
  if (typeof valor === 'number') {
    if (unidade === 'R$' || unidade === 'R$/dia') {
      return brl(valor)
    }
    const numero = Number.isInteger(valor)
      ? valor.toLocaleString('pt-BR')
      : valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
    return unidade ? `${numero} ${unidade}` : numero
  }
  return String(valor)
}

/** Mostra a ficha de decisão no terminal */
function mostrarFicha(ficha: Ficha) {
  const { score } = ficha
  console.log(
    `\n${ficha.ticker} em ${ficha.data} (dados até a véspera) | segmento ${ficha.grupo ?? '-'}`,
  )
  console.log(
    `Score ${score.versao}: ${score.score ?? 'sem cobertura mínima'}${
      score.posicao ? ` | ${score.posicao}º de ${score.totalRanking} FIIs` : ''
    }${
      score.percentilGrupo !== null
        ? ` | melhor que ${Math.round(score.percentilGrupo * 100)}% do segmento`
        : ''
    }`,
  )

  // Mostra como cada critério pesou no score
  console.log('\nComo o score foi formado (pontos somados e perdidos)')
  console.table(
    Object.fromEntries(
      score.criterios.map((c) => [
        c.criterio,
        {
          Valor: valorFicha(c.valor, ''),
          Nota: c.nota ?? 'sem dado',
          Peso: c.peso,
          Somou: c.contribuicao ?? '-',
          Perdeu: c.perdido ?? '-',
        },
      ]),
    ),
  )

  // Mostra os alertas
  console.log('\nAlertas')
  if (ficha.alertas.length === 0) {
    console.log('  nenhum')
  }
  for (const alerta of ficha.alertas) {
    console.log(`  [${alerta.severidade}] ${alerta.mensagem}`)
  }

  // Mostra os melhores do segmento
  if (ficha.pares.length > 0) {
    console.log(`\nMelhores do segmento ${ficha.grupo}`)
    console.table(
      Object.fromEntries(
        ficha.pares.map((p) => [
          p.ticker,
          { Score: p.score, Posição: p.posicao },
        ]),
      ),
    )
  }

  // Mostra o que aconteceu em situações parecidas
  if (ficha.historicoParecidos.length > 0) {
    console.log(
      `\nNo passado, fundos do segmento ${ficha.grupo} com score entre ${
        (score.score ?? 0) - 5
      } e ${(score.score ?? 0) + 5} renderam (preço + proventos)`,
    )
    console.table(
      Object.fromEntries(
        ficha.historicoParecidos.map((h) => [
          `${h.horizonte} dias`,
          {
            Casos: h.casos,
            Mediana: pct(h.mediana),
            'Pior 10%': pct(h.p10),
            'Melhor 10%': pct(h.p90),
            Positivos: pct(h.positivos),
            'Bateu mercado': pct(h.bateuMercado),
            'Bateu CDI': pct(h.bateuCdi),
          },
        ]),
      ),
    )
  }
  if (ficha.historicoProprio.length > 0) {
    console.log(
      `\nHistórico do ${ficha.ticker} (score na data e retorno depois)`,
    )
    console.table(
      Object.fromEntries(
        ficha.historicoProprio.map((h) => [
          h.data,
          {
            Score: h.score ?? '-',
            '90 dias': pct(h.retorno90),
            '1 ano': pct(h.retorno365),
          },
        ]),
      ),
    )
  }

  // Mostra os dados usados, por grupo
  console.log('\nDados conhecidos na data')
  let grupo = ''
  for (const f of ficha.features) {
    if (f.grupo !== grupo) {
      grupo = f.grupo
      console.log(`  ${grupo}`)
    }
    console.log(`    ${f.nome.padEnd(26)} ${valorFicha(f.valor, f.unidade)}`)
  }
  if (ficha.aviso) {
    console.log(`\naviso: ${ficha.aviso}`)
  }
}

/** Monta e mostra a ficha de decisão de um fundo */
function comandoFicha(db: MarketDatabase) {
  const ticker = argumentoPosicional()
  // Se o ticker não foi informado
  if (!ticker) {
    throw new Error('informe o ticker (ex.: bun run backtest ficha XPML11)')
  }
  const provider = new FiiHistoricalProvider(db)
  const pregoes = provider.pregoes()
  // Sem --data, usa o dia seguinte ao último pregão (tudo o que se sabe hoje)
  const data = opcao('data') ?? addDays(pregoes[pregoes.length - 1], 1)
  const ficha = montarFicha(
    provider,
    FiiScorer.versao(opcao('score') ?? 'fii-v1'),
    ticker.toUpperCase(),
    data,
    {
      features: FII_FEATURES,
      grupo: (s) => s.segmento,
      colunaGrupo: 'segmento',
      alertas: alertasFii,
      dataset: { store: new DatasetStore(db.db), tabela: TABELA_DATASET },
    },
  )
  // Se pediu a saída em JSON (para outra ferramenta ou uma IA)
  if (args.includes('--json')) {
    console.log(JSON.stringify(ficha, null, 2))
    return
  }
  mostrarFicha(ficha)
}

/**
 * Executa a mesma estratégia com início em cada mês e mostra a
 * distribuição dos resultados
 */
async function comandoRobustez(db: MarketDatabase) {
  const config = await carregarConfig()
  const passo = Number(opcao('passo') ?? 1)
  const versoes = opcao('scores')?.split(',') ?? [
    opcao('score') ?? config.score,
  ]
  log('carregando a base')
  const backtest = new FiiBacktest(new FiiHistoricalProvider(db))

  // Executa as janelas mostrando o avanço
  let feitas = 0
  const { janelas, resumos } = executarRobustez(
    backtest,
    config,
    versoes,
    passo,
    (janela) => {
      feitas++
      if (feitas % 10 === 0) {
        log(`  ${feitas} janelas (última começando em ${janela.inicio})`)
      }
    },
  )

  // Mostra a distribuição de cada versão
  console.log(
    `\n${janelas.length} janelas de ${config.anos ?? 5} anos, começando a cada ${passo} mês(es)`,
  )
  for (const r of resumos) {
    console.log(
      `\n${r.scoreVersao}: bateu o benchmark em ${pct(r.bateuBenchmark)} das ${r.janelas} janelas`,
    )
    console.table({
      CAGR: {
        Mínimo: pct(r.cagr.minimo),
        '25%': pct(r.cagr.p25),
        Mediana: pct(r.cagr.mediana),
        '75%': pct(r.cagr.p75),
        Máximo: pct(r.cagr.maximo),
      },
      TIR: {
        Mínimo: pct(r.tir.minimo),
        '25%': pct(r.tir.p25),
        Mediana: pct(r.tir.mediana),
        '75%': pct(r.tir.p75),
        Máximo: pct(r.tir.maximo),
      },
      'Excesso de CAGR': {
        Mínimo: pct(r.excessoCagr.minimo),
        '25%': pct(r.excessoCagr.p25),
        Mediana: pct(r.excessoCagr.mediana),
        '75%': pct(r.excessoCagr.p75),
        Máximo: pct(r.excessoCagr.maximo),
      },
      'Drawdown máximo': {
        Mínimo: pct(r.drawdownMaximo.minimo),
        '25%': pct(r.drawdownMaximo.p25),
        Mediana: pct(r.drawdownMaximo.mediana),
        '75%': pct(r.drawdownMaximo.p75),
        Máximo: pct(r.drawdownMaximo.maximo),
      },
    })
  }

  // Grava todas as janelas num CSV
  const caminho =
    opcao('csv') ??
    `data/robustez_${new Date().toISOString().slice(0, 19).replace(/\D/g, '')}.csv`
  const colunas = Object.keys(janelas[0] ?? {})
  await Bun.write(
    caminho,
    [
      colunas.join(','),
      ...janelas.map((j) =>
        colunas
          .map((c) => {
            const valor = j[c as keyof typeof j]
            return valor === null ? '' : String(valor)
          })
          .join(','),
      ),
    ].join('\n'),
  )
  log(`janelas gravadas em ${caminho}`)
}

/** Versões de score pedidas: --scores (várias), --score ou a da configuração */
function versoesPedidas(config: BacktestConfig): string[] {
  const varias = opcao('scores')
  return varias ? varias.split(',') : [opcao('score') ?? config.score]
}

const db = new MarketDatabase()
try {
  switch (comando) {
    case 'ingest': {
      await atualizarBase(
        db,
        lista('tickers'),
        opcao('extras') ? lista('extras') : ['XFIX11'],
        args.includes('--force'),
      )
      break
    }
    case 'simular': {
      const config = await carregarConfig()
      // Atualiza só os tickers da configuração (e o do benchmark, se for um
      // ativo); sem tickers na seleção, atualiza todos
      const tickers = (config.selecao.tickers ?? []).map((t) => t.toUpperCase())
      const benchmark =
        config.benchmark.tipo === 'ativo'
          ? [config.benchmark.ticker.toUpperCase()]
          : []
      await atualizarBase(
        db,
        tickers.length ? [...tickers, ...benchmark] : [],
        ['XFIX11', ...benchmark],
        args.includes('--force'),
      )
      simular(db, config, versoesPedidas(config))
      break
    }
    case 'run': {
      const config = await carregarConfig()
      simular(db, config, versoesPedidas(config))
      break
    }
    case 'compare': {
      const config = await carregarConfig()
      const versoes = opcao('scores')?.split(',') ?? ['fii-v1', 'fii-v0-dy-pvp']
      simular(db, config, versoes)
      break
    }
    case 'list': {
      const store = new BacktestStore(db.db)
      console.table(
        store.listar().map((e) => ({
          id: e.id,
          criado: e.criadoEm.slice(0, 16),
          score: e.scoreVersao,
          periodo: `${e.inicio} a ${e.fim}`,
          cagr: pct(e.resumo.estrategia.cagr),
          benchmark: `${e.benchmark} ${pct(e.resumo.benchmark.cagr)}`,
        })),
      )
      break
    }
    case 'dataset': {
      await comandoDataset(db)
      break
    }
    case 'ficha': {
      comandoFicha(db)
      break
    }
    case 'robustez': {
      await comandoRobustez(db)
      break
    }
    case 'dicionario': {
      const saida = opcao('saida')
      // Se pediu para gravar no arquivo, grava; senão, mostra
      if (saida || args.includes('--gravar')) {
        await Bun.write(saida ?? DOC_DICIONARIO, dicionarioDatasetFii())
        log(`dicionário gravado em ${saida ?? DOC_DICIONARIO}`)
      } else {
        console.log(dicionarioDatasetFii())
      }
      break
    }
    default:
      console.log(
        'uso: bun scripts/backtest.ts <simular|ingest|run|compare|list|dataset|ficha|robustez|dicionario> (veja docs/backtest.md)',
      )
  }
} catch (error) {
  // Mostra só a mensagem do erro, sem a pilha
  console.error(`erro: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
} finally {
  db.fechar()
}
