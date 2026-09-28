import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { retornoEntre } from '../../src/backtest/core/analysis'
import { validarConfig } from '../../src/backtest/core/configSchema'
import { DatasetStore } from '../../src/backtest/core/DatasetStore'
import { montarDataset } from '../../src/backtest/core/dataset'
import type { FeatureDef } from '../../src/backtest/core/features'
import { montarFicha } from '../../src/backtest/core/ficha'
import {
  indicadoresProventos,
  retornoJanela,
  volatilidadeJanela,
} from '../../src/backtest/core/mercado'
import { distribuicao } from '../../src/backtest/core/robustez'
import { rotulosFuturos } from '../../src/backtest/core/rotulos'
import { MarketDatabase } from '../../src/backtest/data/MarketDatabase'
import { linhasSgs, parseNtnb } from '../../src/backtest/data/macro'
import { dicionarioDatasetFii } from '../../src/backtest/fii/dicionario'
import {
  diasUteis,
  SCORE_TESTE,
  TesteBacktest,
  TesteProvider,
  type TesteSnapshot,
} from '../support/backtest'

const pregoes = diasUteis('2023-01-02', '2024-12-31')

/** Provider com um ativo que desdobra 1:10 em 2024-01-02 e paga proventos */
function comDesdobramento() {
  return new TesteProvider({
    pregoes,
    precos: {
      A: pregoes.map((d, i) =>
        d < '2024-01-02' ? 100 + (i % 5) : 10 + (i % 5) / 10,
      ),
    },
    eventos: [
      {
        ativoId: 'A',
        data: '2024-01-02',
        tipo: 'desdobramento',
        fator: 10,
        fonte: 't',
      },
    ],
    proventos: [
      {
        ativoId: 'A',
        dataCom: '2023-12-28',
        dataPagamento: '2024-01-10',
        valor: 1,
        fonte: 't',
      },
      {
        ativoId: 'A',
        dataCom: '2024-02-29',
        dataPagamento: '2024-03-10',
        valor: 0.1,
        fonte: 't',
      },
      {
        ativoId: 'A',
        dataCom: '2024-03-28',
        dataPagamento: '2024-04-10',
        valor: 0.5,
        tipo: 'Amortização',
        fonte: 't',
      },
    ],
    notas: [{ ativoId: 'A', entrega: '2022-12-01', nota: 50 }],
  })
}

describe('rótulos', () => {
  test('batem com o retorno da análise (desdobramento e proventos)', () => {
    const provider = comDesdobramento()
    const [rotulo] = rotulosFuturos(
      provider,
      'A',
      '2023-12-01',
      100,
      [120],
      '2024-12-31',
    )
    const referencia = retornoEntre(
      provider,
      'A',
      '2023-12-01',
      100,
      rotulo.dataFinal,
      120,
    )
    expect(rotulo.retornoTotal).toBeCloseTo(referencia?.retornoTotal ?? 0, 10)
    expect(rotulo.retornoDividendos).toBeCloseTo(
      referencia?.retornoDividendos ?? 0,
      10,
    )
  })

  test('drawdown é a pior queda desde a compra', () => {
    const datas = diasUteis('2024-01-01', '2024-03-29')
    const precos = datas.map((d) =>
      d < '2024-02-01' ? 10 : d < '2024-03-01' ? 7 : 12,
    )
    const provider = new TesteProvider({
      pregoes: datas,
      precos: { A: precos },
    })
    const [rotulo] = rotulosFuturos(
      provider,
      'A',
      '2024-01-02',
      10,
      [60],
      '2024-03-29',
    )
    expect(rotulo.drawdown).toBeCloseTo(-0.3, 10)
  })

  test('horizonte que ainda não terminou fica de fora', () => {
    const provider = comDesdobramento()
    const rotulos = rotulosFuturos(
      provider,
      'A',
      '2024-11-01',
      10,
      [30, 365],
      '2024-12-31',
    )
    expect(rotulos.map((r) => r.horizonte)).toEqual([30])
  })
})

describe('indicadores de mercado', () => {
  test('retorno de 12 meses atravessa o desdobramento', () => {
    const provider = comDesdobramento()
    const view = provider.visao('2024-06-03')
    // De ~100 (base antiga) para ~10 (base nova) + 1 + 0,1 + 0,5 de proventos
    const retorno = retornoJanela(view, 'A', 365) ?? 0
    expect(Math.abs(retorno)).toBeLessThan(25)
  })

  test('DY não conta amortização; amortização fica à parte', () => {
    const provider = comDesdobramento()
    const view = provider.visao('2024-06-03')
    const preco = view.ultimoPreco('A')?.fechamento ?? 0
    const p = indicadoresProventos(view, 'A', preco)
    // 1 por cota antiga (= 0,1 na base atual) + 0,1
    expect(p.dy12m).toBeCloseTo((0.2 / preco) * 100, 3)
    expect(p.amortizacao12m).toBeCloseTo((0.5 / preco) * 100, 3)
  })

  test('volatilidade exige pelo menos 20 retornos', () => {
    const provider = comDesdobramento()
    expect(volatilidadeJanela(provider.visao('2023-01-10'), 'A', 30)).toBeNull()
    expect(
      volatilidadeJanela(provider.visao('2023-06-01'), 'A', 91),
    ).not.toBeNull()
  })
})

describe('macro', () => {
  test('NTN-B: escolhe o título mais perto de 10 anos em cada dia', () => {
    const csv = [
      'Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha',
      'Tesouro IPCA+ com Juros Semestrais;15/05/2030;02/01/2024;5,10',
      'Tesouro IPCA+ com Juros Semestrais;15/08/2034;02/01/2024;5,60',
      'Tesouro IPCA+ com Juros Semestrais;15/05/2045;02/01/2024;5,80',
      'Tesouro Selic;01/03/2029;02/01/2024;0,05',
    ].join('\n')
    expect(parseNtnb(csv)).toEqual([
      {
        serie: 'ntnb_10a',
        data: '2024-01-02',
        valor: 5.6,
        conhecidoEm: '2024-01-02',
      },
    ])
  })

  test('IPCA só é conhecido no dia 15 do mês seguinte', () => {
    const [linha] = linhasSgs('ipca_12m', [{ data: '2024-03-01', valor: 4 }])
    expect(linha.conhecidoEm).toBe('2024-04-15')
  })
})

describe('dataset', () => {
  /** Features mínimas para o teste */
  const FEATURES: FeatureDef<TesteSnapshot>[] = [
    {
      nome: 'nota',
      grupo: 'Teste',
      descricao: 'nota publicada',
      tipo: 'numero',
      unidade: '',
      fonte: 'teste',
      conhecido: 'entrega antes da data',
      valor: (s) => s.nota,
    },
    {
      nome: 'liquidez_media',
      grupo: 'Teste',
      descricao: 'liquidez',
      tipo: 'numero',
      unidade: 'R$',
      fonte: 'teste',
      conhecido: 'pregão anterior',
      valor: (s) => s.liquidezMedia,
    },
  ]

  /** Dois ativos: A sobe 10% em janeiro de 2024, B fica parado */
  function provider() {
    return new TesteProvider({
      pregoes,
      precos: {
        A: pregoes.map((d) => (d < '2024-01-15' ? 10 : 11)),
        B: pregoes.map(() => 10),
      },
      notas: [
        { ativoId: 'A', entrega: '2022-12-01', nota: 80 },
        { ativoId: 'B', entrega: '2022-12-01', nota: 40 },
        { ativoId: 'A', entrega: '2024-01-02', nota: 10 },
      ],
      cdi: 0.0004,
    })
  }

  function montar() {
    const p = provider()
    return montarDataset(p, FEATURES, {
      inicio: '2023-12-01',
      fim: '2024-01-31',
      frequencia: 'mensal',
      horizontes: [30],
      scorers: [new TesteBacktest(p).criarScorer()],
    })
  }

  test('uma linha por ativo e data, com a feature conhecida na data', () => {
    const { linhas } = montar()
    expect(linhas.map((l) => `${l.data}:${l.ativo_id}:${l.nota}`)).toEqual([
      '2023-12-01:A:80',
      '2023-12-01:B:40',
      '2024-01-01:A:80',
      '2024-01-01:B:40',
    ])
  })

  test('rótulos: retorno, excesso sobre o mercado, CDI e percentil', () => {
    const { linhas } = montar()
    const a = linhas.find((l) => l.data === '2024-01-01' && l.ativo_id === 'A')
    const b = linhas.find((l) => l.data === '2024-01-01' && l.ativo_id === 'B')
    expect(a?.ret_total_30d).toBeCloseTo(0.1, 10)
    expect(b?.ret_total_30d).toBeCloseTo(0, 10)
    // Mercado = média de A e B (ambos com liquidez >= 500 mil)
    expect(a?.excesso_mercado_30d).toBeCloseTo(0.05, 10)
    expect(a?.bateu_mercado_30d).toBe(true)
    expect(b?.bateu_cdi_30d).toBe(false)
    expect(a?.percentil_30d).toBe(1)
    expect(b?.percentil_30d).toBe(0)
  })

  test('grava, lê os metadados e exporta o CSV', async () => {
    const db = new MarketDatabase(':memory:')
    const store = new DatasetStore(db.db)
    store.salvar('dataset_teste', montar(), {
      codigoVersao: 'abc',
      dadosVersao: 'x',
      opcoes: { scores: ['teste-v1'] },
    })
    expect(store.meta('dataset_teste')?.linhas).toBe(4)

    const caminho = join(mkdtempSync(join(tmpdir(), 'bt-')), 'd.csv')
    await store.exportarCsv('dataset_teste', caminho)
    const [cabecalho, primeira] = readFileSync(caminho, 'utf8').split('\n')
    expect(cabecalho.startsWith('data,ativo_id,ticker,preco_base')).toBe(true)
    expect(primeira.startsWith('2023-12-01,A,A,10,1,80')).toBe(true)
  })
})

describe('ficha', () => {
  test('os pontos dos critérios somam o score; sem dataset, avisa', () => {
    const p = new TesteProvider({
      pregoes,
      precos: { A: pregoes.map(() => 10) },
      notas: [{ ativoId: 'A', entrega: '2022-12-01', nota: 73 }],
    })
    const ficha = montarFicha(
      p,
      new TesteBacktest(p).criarScorer(),
      'A',
      '2024-06-03',
      {
        features: [],
        grupo: () => 'g',
        colunaGrupo: 'g',
        alertas: () => [],
      },
    )
    const soma = ficha.score.criterios.reduce(
      (s, c) => s + (c.contribuicao ?? 0),
      0,
    )
    expect(soma).toBeCloseTo(ficha.score.score ?? 0, 1)
    expect(ficha.aviso).toContain('sem dataset')
  })
})

describe('robustez', () => {
  test('distribuição com quartis', () => {
    expect(distribuicao([4, 1, 3, 2, null])).toEqual({
      minimo: 1,
      p25: 1.75,
      mediana: 2.5,
      p75: 3.25,
      maximo: 4,
    })
  })
})

describe('configuração', () => {
  const valida = {
    aporte: { valor: 1000, frequencia: 'mensal' },
    selecao: { quantidade: 5 },
    distribuicao: 'igual',
    reinvestirDividendos: true,
    rebalanceamento: { frequencia: 'nenhum' },
    benchmark: { tipo: 'cdi' },
    score: SCORE_TESTE.versao,
  }

  test('aceita a configuração válida', () => {
    expect(() => validarConfig(valida)).not.toThrow()
  })

  test('recusa campo desconhecido e valor fora da lista', () => {
    expect(() => validarConfig({ ...valida, aportes: 1 })).toThrow('aportes')
    expect(() =>
      validarConfig({
        ...valida,
        aporte: { valor: 1000, frequencia: 'anual' },
      }),
    ).toThrow('configuração inválida')
  })
})

describe('dicionário', () => {
  test('docs/backtest-dataset.md está em dia com o registro de features', () => {
    const arquivo = readFileSync('docs/backtest-dataset.md', 'utf8')
    expect(arquivo.replaceAll('\r\n', '\n')).toBe(dicionarioDatasetFii())
  })
})
