import { describe, expect, test } from 'bun:test'

import {
  analisarFaixas,
  nomeFaixa,
  retornoEntre,
} from '../../src/backtest/core/analysis'
import {
  addMonths,
  datasAporte,
  datasRebalanceamento,
} from '../../src/backtest/core/dates'
import { drawdownMaximo, tir } from '../../src/backtest/core/metrics'
import { Portfolio } from '../../src/backtest/core/Portfolio'
import { notaDaFaixa } from '../../src/backtest/core/Scorer'
import type { BacktestConfig } from '../../src/backtest/core/types'
import { diasUteis, TesteBacktest, TesteProvider } from '../support/backtest'

const SEM_CUSTO = { fracionado: false, custoOperacao: 0, aliquotaIr: 0.2 }

/** Configuração base: aporte mensal de 1000 no melhor ativo, sem custos */
function config(extra: Partial<BacktestConfig> = {}): BacktestConfig {
  return {
    aporte: { valor: 1000, frequencia: 'mensal', dia: 1 },
    selecao: { quantidade: 1 },
    distribuicao: 'igual',
    reinvestirDividendos: true,
    rebalanceamento: { frequencia: 'nenhum' },
    benchmark: { tipo: 'cdi' },
    score: 'teste-v1',
    custoOperacao: 0,
    horizontes: [30],
    ...extra,
  }
}

describe('datas', () => {
  const pregoes = diasUteis('2024-01-01', '2024-03-31')

  test('mensal usa o primeiro pregão a partir do dia pedido', () => {
    expect(datasAporte(pregoes, 'mensal', 10)).toEqual([
      '2024-01-10',
      '2024-02-12',
      '2024-03-11',
    ])
  })

  test('mensal com dia depois do fim do mês usa o último pregão do mês', () => {
    expect(datasAporte(pregoes, 'mensal', 31)).toEqual([
      '2024-01-31',
      '2024-02-29',
      '2024-03-29',
    ])
  })

  test('semanal usa o dia da semana pedido', () => {
    const datas = datasAporte(pregoes, 'semanal', 3)
    expect(datas[0]).toBe('2024-01-03')
    expect(
      datas.every((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 3),
    ).toBe(true)
  })

  test('rebalanceamento trimestral não conta o primeiro aporte', () => {
    const aportes = datasAporte(
      diasUteis('2024-01-01', '2024-12-31'),
      'mensal',
      1,
    )
    expect([...datasRebalanceamento(aportes, 'trimestral')]).toEqual([
      '2024-04-01',
      '2024-07-01',
      '2024-10-01',
    ])
  })

  test('addMonths para no fim do mês', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
  })
})

describe('score', () => {
  test('nota interpola entre os pontos e trava nas pontas', () => {
    const faixa: [number, number][] = [
      [1, 100],
      [2, 0],
    ]
    expect(notaDaFaixa(0.5, faixa)).toBe(100)
    expect(notaDaFaixa(1.5, faixa)).toBe(50)
    expect(notaDaFaixa(3, faixa)).toBe(0)
  })
})

describe('Portfolio', () => {
  test('compra só cotas inteiras e guarda a sobra no caixa', () => {
    const carteira = new Portfolio(SEM_CUSTO, true)
    carteira.aportar(1000)
    expect(carteira.comprar('2024-01-02', 'A', 'A', 1000, 300)).toBe(3)
    expect(carteira.caixa).toBe(100)
  })

  test('IR sobre o lucro compensa o prejuízo anterior', () => {
    const carteira = new Portfolio(SEM_CUSTO, true)
    carteira.aportar(2000)
    carteira.comprar('2024-01-02', 'A', 'A', 1000, 100)
    carteira.comprar('2024-01-02', 'B', 'B', 1000, 100)
    // Vende A com prejuízo de 200 e B com lucro de 500
    carteira.vender('2024-02-01', 'A', 80, 'teste')
    carteira.vender('2024-02-01', 'B', 150, 'teste')
    expect(carteira.irPago).toBe(60)
    expect(carteira.caixa).toBe(800 + 1500 - 60)
  })

  test('desdobramento multiplica as cotas e mantém o custo', () => {
    const carteira = new Portfolio(SEM_CUSTO, true)
    carteira.aportar(1000)
    carteira.comprar('2024-01-02', 'A', 'A', 1000, 100)
    carteira.desdobrar('2024-02-01', 'A', 10, 10)
    const posicao = carteira.posicoes.get('A')
    expect(posicao?.quantidade).toBe(100)
    expect(posicao?.custoTotal).toBe(1000)
  })

  test('grupamento vende a fração que sobra', () => {
    const carteira = new Portfolio(SEM_CUSTO, true)
    carteira.aportar(1000)
    carteira.comprar('2024-01-02', 'A', 'A', 1000, 100)
    carteira.desdobrar('2024-02-01', 'A', 1 / 3, 300)
    expect(carteira.posicoes.get('A')?.quantidade).toBe(3)
    expect(carteira.caixa).toBeCloseTo(100, 6)
  })

  test('provento vai para o caixa ou fica parado conforme o reinvestimento', () => {
    for (const reinvestir of [true, false]) {
      const carteira = new Portfolio(SEM_CUSTO, reinvestir)
      carteira.aportar(1000)
      carteira.comprar('2024-01-02', 'A', 'A', 1000, 100)
      carteira.provisionarProvento('A', '2024-01-31', '2024-02-15', 1, 'teste')
      carteira.receberProventos('2024-02-14')
      expect(carteira.proventosAReceber).toBe(10)
      carteira.receberProventos('2024-02-15')
      expect(carteira.caixa).toBe(reinvestir ? 10 : 0)
      expect(carteira.dividendosParados).toBe(reinvestir ? 0 : 10)
    }
  })
})

describe('métricas', () => {
  test('drawdown é a maior queda desde o pico', () => {
    expect(drawdownMaximo([1, 1.2, 0.9, 1.3, 1.04])).toBeCloseTo(-0.25, 10)
  })

  test('TIR de 10% em um ano', () => {
    const taxa = tir([
      { data: '2023-01-01', valor: -100 },
      { data: '2024-01-01', valor: 110 },
    ])
    expect(taxa).toBeCloseTo(0.1, 6)
  })
})

describe('análise', () => {
  test('faixas de score', () => {
    expect(nomeFaixa(55)).toBe('50-59')
    expect(nomeFaixa(90)).toBe('90+')
    expect(nomeFaixa(100)).toBe('90+')
  })

  test('excesso por faixa tira a média do mercado na mesma data', () => {
    const faixas = analisarFaixas([
      { data: 'd1', score: 95, horizonte: 30, retornoTotal: 0.1 },
      { data: 'd1', score: 55, horizonte: 30, retornoTotal: 0 },
    ])
    const alta = faixas.find((f) => f.faixa === '90+')
    expect(alta?.excessoMedio).toBeCloseTo(0.05, 10)
  })

  test('retorno depois da recomendação ajusta desdobramento e soma proventos', () => {
    const pregoes = diasUteis('2024-01-01', '2024-01-31')
    const precos = pregoes.map((d) => (d < '2024-01-15' ? 100 : 10.5))
    const provider = new TesteProvider({
      pregoes,
      precos: { A: precos },
      eventos: [
        {
          ativoId: 'A',
          data: '2024-01-15',
          tipo: 'desdobramento',
          fator: 10,
          fonte: 't',
        },
      ],
      proventos: [
        // Antes do desdobramento: 1 por cota antiga; depois: 0,1 por cota nova
        {
          ativoId: 'A',
          dataCom: '2024-01-10',
          dataPagamento: '2024-01-20',
          valor: 1,
          fonte: 't',
        },
        {
          ativoId: 'A',
          dataCom: '2024-01-20',
          dataPagamento: '2024-01-30',
          valor: 0.1,
          fonte: 't',
        },
      ],
    })
    const retorno = retornoEntre(
      provider,
      'A',
      '2024-01-02',
      100,
      '2024-01-31',
      30,
    )
    expect(retorno?.precoFinal).toBeCloseTo(105, 10)
    expect(retorno?.dividendosPorCota).toBeCloseTo(2, 10)
    expect(retorno?.retornoTotal).toBeCloseTo(0.07, 10)
  })
})

describe('Backtest', () => {
  // Um mês de histórico antes do primeiro aporte
  const pregoes = diasUteis('2023-12-01', '2024-06-30')
  const constante = (valor: number) => pregoes.map(() => valor)

  test('não usa informação futura: a nota entregue no dia do aporte ainda não vale', () => {
    // B publica uma nota melhor exatamente no dia do aporte de fevereiro
    const provider = new TesteProvider({
      pregoes,
      precos: { A: constante(10), B: constante(10) },
      notas: [
        { ativoId: 'A', entrega: '2023-11-01', nota: 60 },
        { ativoId: 'B', entrega: '2023-11-01', nota: 50 },
        { ativoId: 'B', entrega: '2024-02-01', nota: 90 },
      ],
    })
    const resultado = new TesteBacktest(provider).executar(
      config({ inicio: '2024-01-01', fim: '2024-03-31' }),
    )
    const escolhidos = resultado.recomendacoes
      .filter((r) => r.selecionado)
      .map((r) => `${r.data}:${r.ativoId}`)
    expect(escolhidos).toEqual(['2024-01-01:A', '2024-02-01:A', '2024-03-01:B'])
  })

  test('o score usa o fechamento da véspera, a compra usa o do dia', () => {
    const precos = constante(10)
    precos[pregoes.indexOf('2024-02-01')] = 20
    const provider = new TesteProvider({
      pregoes,
      precos: { A: precos },
      notas: [{ ativoId: 'A', entrega: '2023-11-01', nota: 50 }],
    })
    const resultado = new TesteBacktest(provider).executar(
      config({ inicio: '2024-02-01', fim: '2024-02-29' }),
    )
    const [recomendacao] = resultado.recomendacoes
    expect(recomendacao.precoReferencia).toBe(10)
    expect(recomendacao.precoCompra).toBe(20)
  })

  test('ativo que ainda não negociava fica fora do universo', () => {
    const tardio = pregoes.map((d) => (d >= '2024-03-01' ? 10 : null))
    const provider = new TesteProvider({
      pregoes,
      precos: { A: constante(10), B: tardio },
      notas: [
        { ativoId: 'A', entrega: '2023-11-01', nota: 50 },
        { ativoId: 'B', entrega: '2023-11-01', nota: 90 },
      ],
    })
    const resultado = new TesteBacktest(provider).executar(
      config({ inicio: '2024-01-01', fim: '2024-03-31' }),
    )
    const marco = resultado.recomendacoes.filter((r) => r.data === '2024-03-01')
    expect(marco.map((r) => r.ativoId)).toEqual(['A'])
  })

  test('posição sem negociação é encerrada ao último preço', () => {
    const encerrado = pregoes.map((d) => (d <= '2024-02-15' ? 10 : null))
    const provider = new TesteProvider({
      pregoes,
      precos: { A: encerrado },
      notas: [{ ativoId: 'A', entrega: '2023-11-01', nota: 50 }],
    })
    const resultado = new TesteBacktest(provider).executar(
      config({ inicio: '2024-01-01', fim: '2024-06-28' }),
    )
    const encerramento = resultado.operacoes.find(
      (o) => o.tipo === 'encerramento',
    )
    expect(encerramento?.preco).toBe(10)
    expect(resultado.posicoesFinais).toEqual([])
  })

  test('preço constante com proventos: patrimônio = aportes + proventos', () => {
    const provider = new TesteProvider({
      pregoes,
      precos: { A: constante(10) },
      notas: [{ ativoId: 'A', entrega: '2023-11-01', nota: 50 }],
      proventos: [
        ['2024-01-31', '2024-02-15'],
        ['2024-02-29', '2024-03-15'],
        ['2024-03-28', '2024-04-15'],
      ].map(([dataCom, dataPagamento]) => ({
        ativoId: 'A',
        dataCom,
        dataPagamento,
        valor: 0.1,
        fonte: 't',
      })),
    })
    const resultado = new TesteBacktest(provider).executar(
      config({
        inicio: '2024-01-01',
        fim: '2024-04-30',
        reinvestirDividendos: false,
      }),
    )
    const e = resultado.resumo.estrategia
    // 100 cotas em jan, 200 em fev, 300 em mar -> 10 + 20 + 30 de proventos
    expect(e.aportado).toBe(4000)
    expect(e.dividendosRecebidos).toBeCloseTo(60, 6)
    expect(e.patrimonioFinal).toBeCloseTo(4060, 6)
    expect(e.valorizacao).toBeCloseTo(0, 6)
  })

  test('benchmark CDI recebe os mesmos aportes', () => {
    const provider = new TesteProvider({
      pregoes,
      precos: { A: constante(10) },
      notas: [{ ativoId: 'A', entrega: '2023-11-01', nota: 50 }],
      cdi: 0.0004,
    })
    const resultado = new TesteBacktest(provider).executar(
      config({ inicio: '2024-01-01', fim: '2024-01-31' }),
    )
    const pontos = resultado.carteira
    const dias = pontos.length - 1
    expect(resultado.resumo.benchmark.patrimonioFinal).toBeCloseTo(
      1000 * 1.0004 ** dias,
      6,
    )
  })

  test('saldo inicial é investido no primeiro pregão, mesmo fora da data de aporte', () => {
    const provider = new TesteProvider({
      pregoes,
      precos: { A: constante(10) },
      notas: [{ ativoId: 'A', entrega: '2023-11-01', nota: 50 }],
    })
    const resultado = new TesteBacktest(provider).executar(
      config({
        inicio: '2024-01-10',
        fim: '2024-02-29',
        saldoInicial: 5000,
        aporte: { valor: 1000, frequencia: 'mensal', dia: 15 },
      }),
    )
    const compras = resultado.operacoes.filter((o) => o.tipo === 'compra')
    expect(compras.map((o) => [o.data, o.quantidade])).toEqual([
      ['2024-01-10', 500],
      ['2024-01-15', 100],
      ['2024-02-15', 100],
    ])
    expect(resultado.resumo.estrategia.aportado).toBe(7000)
  })

  test('cotas iniciais entram pelo preço do primeiro pregão e contam como aportado', () => {
    const provider = new TesteProvider({
      pregoes,
      precos: { A: constante(10), B: constante(20) },
      notas: [{ ativoId: 'A', entrega: '2023-11-01', nota: 50 }],
    })
    const resultado = new TesteBacktest(provider).executar(
      config({
        inicio: '2024-01-01',
        fim: '2024-01-31',
        cotasIniciais: [{ ticker: 'B', quantidade: 30 }],
      }),
    )
    // 30 cotas de B a 20 + o aporte de janeiro
    expect(resultado.resumo.estrategia.aportado).toBe(1600)
    expect(resultado.resumo.estrategia.patrimonioFinal).toBeCloseTo(1600, 6)
    expect(
      resultado.posicoesFinais.find((p) => p.ativoId === 'B')?.quantidade,
    ).toBe(30)
  })

  test('cotas iniciais de ticker fora da base dão erro claro', () => {
    const provider = new TesteProvider({
      pregoes,
      precos: { A: constante(10) },
      notas: [{ ativoId: 'A', entrega: '2023-11-01', nota: 50 }],
    })
    expect(() =>
      new TesteBacktest(provider).executar(
        config({ cotasIniciais: [{ ticker: 'ZZZZ11', quantidade: 1 }] }),
      ),
    ).toThrow('cotas iniciais: ZZZZ11')
  })

  test('benchmark universo com um só ativo acompanha a carteira', () => {
    const precos = pregoes.map((_, i) => 10 + (i % 7))
    const provider = new TesteProvider({
      pregoes,
      precos: { A: precos },
      notas: [{ ativoId: 'A', entrega: '2023-11-01', nota: 50 }],
    })
    const resultado = new TesteBacktest(provider).executar(
      config({
        inicio: '2024-01-01',
        fim: '2024-06-28',
        benchmark: { tipo: 'universo' },
        fracionado: true,
      }),
    )
    const { estrategia, benchmark } = resultado.resumo
    expect(benchmark.patrimonioFinal).toBeCloseTo(estrategia.patrimonioFinal, 6)
  })

  test('rebalanceamento vende o que saiu da seleção', () => {
    const provider = new TesteProvider({
      pregoes,
      precos: { A: constante(10), B: constante(10) },
      notas: [
        { ativoId: 'A', entrega: '2023-11-01', nota: 60 },
        { ativoId: 'B', entrega: '2023-11-01', nota: 50 },
        { ativoId: 'B', entrega: '2024-01-15', nota: 90 },
      ],
    })
    const resultado = new TesteBacktest(provider).executar(
      config({
        inicio: '2024-01-01',
        fim: '2024-02-29',
        rebalanceamento: { frequencia: 'mensal' },
      }),
    )
    const venda = resultado.operacoes.find((o) => o.tipo === 'venda')
    expect(venda).toMatchObject({
      data: '2024-02-01',
      ativoId: 'A',
      quantidade: 100,
    })
    expect(resultado.posicoesFinais.map((p) => p.ativoId)).toEqual(['B'])
  })
})
