import { describe, expect, test } from 'bun:test'

import { parseCotahistLinha } from '../../src/backtest/data/b3Cotahist'
import {
  type CvmLinha,
  MarketDatabase,
} from '../../src/backtest/data/MarketDatabase'
import {
  FiiHistoricalProvider,
  segmentoPelaComposicao,
  vacanciaMedia,
} from '../../src/backtest/fii/FiiHistoricalProvider'
import { FiiScorer } from '../../src/backtest/fii/FiiScorer'
import {
  converterProventosStatusInvest,
  detectarDesdobramentos,
} from '../../src/backtest/fii/ingest'
import type { CvmFundo } from '../../src/types/cvm.type'
import type { RootDividend } from '../../src/types/dividends.type'
import { diasUteis } from '../support/backtest'

const ISIN = 'BRTESTCTF000'
const CNPJ = '11111111000111'
const silencioso = () => {}

/** Monta uma linha do COTAHIST no layout de posições fixas */
function linhaCotahist(campos: {
  data: string
  codbdi?: string
  ticker: string
  especi?: string
  fechamento: number
  volume: number
  isin?: string
}): string {
  const linha = Array<string>(245).fill(' ')
  const escrever = (inicio: number, texto: string) => {
    linha.splice(inicio, texto.length, ...texto)
  }
  const centavos = (valor: number, tamanho: number) =>
    String(Math.round(valor * 100)).padStart(tamanho, '0')
  escrever(0, '01')
  escrever(2, campos.data.replaceAll('-', ''))
  escrever(10, campos.codbdi ?? '12')
  escrever(12, campos.ticker.padEnd(12))
  escrever(24, '010')
  escrever(27, 'FII TESTE   ')
  escrever(39, (campos.especi ?? 'CI').padEnd(10))
  escrever(108, centavos(campos.fechamento, 13))
  escrever(147, '00042')
  escrever(170, centavos(campos.volume, 18))
  escrever(230, campos.isin ?? ISIN)
  return linha.join('')
}

/** Linha de informe da CVM */
function cvm(
  arquivo: string,
  referencia: string,
  versao: number,
  entrega: string,
  dados: Record<string, string>,
): CvmLinha {
  return {
    cnpj: CNPJ,
    arquivo,
    dataReferencia: referencia,
    versao,
    dataEntrega: entrega,
    dados: {
      CNPJ_Fundo_Classe: '11.111.111/0001-11',
      Data_Referencia: referencia,
      Versao: String(versao),
      ...dados,
    },
  }
}

describe('COTAHIST', () => {
  test('lê a cota do FII com preços em centavos implícitos', () => {
    const linha = linhaCotahist({
      data: '2024-05-02',
      ticker: 'TEST11',
      fechamento: 98.76,
      volume: 1_234_567.89,
    })
    expect(parseCotahistLinha(linha, () => true)).toEqual({
      ativoId: ISIN,
      data: '2024-05-02',
      ticker: 'TEST11',
      codbdi: '12',
      nome: 'FII TESTE',
      fechamento: 98.76,
      volume: 1_234_567.89,
      negocios: 42,
    })
  })

  test('cota no período ex-rendimento ("CI  ER") continua sendo cota', () => {
    const linha = linhaCotahist({
      data: '2024-05-02',
      ticker: 'TEST11',
      especi: 'CI  ER',
      fechamento: 98.76,
      volume: 1,
    })
    expect(parseCotahistLinha(linha, (c) => c.especi === 'CI')).not.toBeNull()
  })

  test('recusa as linhas que o filtro não aceita (ex.: direitos)', () => {
    const linha = linhaCotahist({
      data: '2024-05-02',
      ticker: 'TEST12',
      especi: 'DIR',
      fechamento: 1,
      volume: 1,
    })
    expect(parseCotahistLinha(linha, (c) => c.especi === 'CI')).toBeNull()
  })
})

describe('proventos do statusinvest', () => {
  test('usa o valor original quando o statusinvest ajustou por desdobramento', () => {
    const dados = {
      assetEarningsModels: [
        {
          ed: '30/06/2016',
          pd: '14/07/2016',
          v: 0.87,
          ov: 8.7,
          adj: true,
          et: 'Rendimento',
        },
        {
          ed: '31/08/2026',
          pd: '15/09/2026',
          v: 1.17,
          adj: false,
          et: 'Rendimento',
        },
      ],
    } as unknown as RootDividend
    expect(
      converterProventosStatusInvest(ISIN, dados).map((p) => [
        p.dataCom,
        p.valor,
      ]),
    ).toEqual([
      ['2016-06-30', 8.7],
      ['2026-08-31', 1.17],
    ])
  })
})

describe('segmento e vacância', () => {
  const fundo = (composicao: CvmFundo['composicao']) =>
    ({ composicao, imoveis: [] }) as unknown as CvmFundo

  test('segmento pela classe com mais dinheiro, ou Híbrido abaixo de 60%', () => {
    expect(
      segmentoPelaComposicao(fundo({ data: '', imoveis: 90, cri: 10, fii: 0 })),
    ).toBe('Tijolo')
    expect(
      segmentoPelaComposicao(fundo({ data: '', imoveis: 50, cri: 50, fii: 0 })),
    ).toBe('Híbrido')
    expect(segmentoPelaComposicao(fundo(null))).toBeNull()
  })

  test('vacância média pesada pela área dos imóveis de renda', () => {
    const comImoveis = {
      imoveis: [
        { classe: 'renda_acabado', area: 3000, vacancia: 0 },
        { classe: 'renda_acabado', area: 1000, vacancia: 0.4 },
        { classe: 'venda_acabado', area: 9000, vacancia: 1 },
      ],
    } as unknown as CvmFundo
    expect(vacanciaMedia(comImoveis)).toBe(10)
  })
})

describe('FiiHistoricalProvider', () => {
  /** Base com um FII negociado a 100 de dezembro a abril */
  function base(): MarketDatabase {
    const db = new MarketDatabase(':memory:')
    db.inserirPrecos(
      diasUteis('2023-12-01', '2024-04-30').map((data) => ({
        ativoId: ISIN,
        data,
        ticker: 'TEST11',
        codbdi: '12',
        nome: 'FII TESTE',
        fechamento: 100,
        volume: 1_000_000,
        negocios: 10,
      })),
    )
    db.substituirCvm('inf_mensal_fii_geral', 2024, [
      cvm('inf_mensal_fii_geral', '2024-01-01', 1, '2024-02-15', {
        Codigo_ISIN: ISIN,
      }),
    ])
    db.substituirCvm('inf_mensal_fii_complemento', 2024, [
      // Janeiro: entregue em 15/02, reapresentado em 01/04 com outro valor
      cvm('inf_mensal_fii_complemento', '2024-01-01', 1, '2024-02-15', {
        Valor_Patrimonial_Cotas: '125',
      }),
      cvm('inf_mensal_fii_complemento', '2024-01-01', 2, '2024-04-01', {
        Valor_Patrimonial_Cotas: '80',
      }),
      // Fevereiro: entregue em 15/03
      cvm('inf_mensal_fii_complemento', '2024-02-01', 1, '2024-03-15', {
        Valor_Patrimonial_Cotas: '100',
      }),
    ])
    return db
  }

  /** P/VP do FII no universo da data */
  function pvpEm(provider: FiiHistoricalProvider, data: string) {
    return provider.universo(data).find((s) => s.ativoId === ISIN)?.pvp ?? null
  }

  test('usa só os informes entregues antes da data (e a versão válida na data)', () => {
    const provider = new FiiHistoricalProvider(base())
    // Antes da primeira entrega não há fundamento
    expect(pvpEm(provider, '2024-02-15')).toBeNull()
    // Janeiro, versão 1
    expect(pvpEm(provider, '2024-02-16')).toBe(0.8)
    // Fevereiro entregue em 15/03 passa a valer no dia seguinte
    expect(pvpEm(provider, '2024-03-15')).toBe(0.8)
    expect(pvpEm(provider, '2024-03-18')).toBe(1)
    // A reapresentação de janeiro não muda o informe mais recente (fevereiro)
    expect(pvpEm(provider, '2024-04-02')).toBe(1)
  })

  test('DY 12m leva os proventos anteriores ao desdobramento para a base atual', () => {
    const db = new MarketDatabase(':memory:')
    // Preço de 100 até o desdobramento 1:10 em 01/03, depois 10
    db.inserirPrecos(
      diasUteis('2023-12-01', '2024-04-30').map((data) => ({
        ativoId: ISIN,
        data,
        ticker: 'TEST11',
        codbdi: '12',
        nome: 'FII TESTE',
        fechamento: data < '2024-03-01' ? 100 : 10,
        volume: 1_000_000,
        negocios: 10,
      })),
    )
    db.substituirEventos('t', [
      {
        ativoId: ISIN,
        data: '2024-03-01',
        tipo: 'desdobramento',
        fator: 10,
        descricao: null,
        fonte: 't',
      },
    ])
    // 1 por cota antiga antes; 0,1 por cota nova depois
    db.substituirProventos(
      'statusinvest',
      [ISIN],
      [
        ['2024-01-31', 1],
        ['2024-02-29', 1],
        ['2024-03-28', 0.1],
      ].map(([dataCom, valor]) => ({
        ativoId: ISIN,
        dataCom: String(dataCom),
        dataPagamento: String(dataCom),
        valor: Number(valor),
        tipo: 'Rendimento',
        fonte: 'statusinvest',
      })),
    )
    const [snapshot] = new FiiHistoricalProvider(db).universo('2024-04-15')
    // 0,1 + 0,1 + 0,1 por cota nova, a 10 -> 3%
    expect(snapshot.dy12m).toBeCloseTo(3, 6)
  })

  test('o score da v1 exige cobertura mínima dos critérios', () => {
    const provider = new FiiHistoricalProvider(base())
    const scorer = FiiScorer.versao('fii-v1')
    const [snapshot] = provider.universo('2024-03-18')
    // Só P/VP e liquidez têm dado: abaixo de 60% do peso
    expect(scorer.avaliar(snapshot)).toBeNull()
    expect(FiiScorer.versao('fii-v0-dy-pvp').avaliar(snapshot)).toBeNull()
  })

  test('versão de score desconhecida', () => {
    expect(() => FiiScorer.versao('nao-existe')).toThrow(
      'versão de score desconhecida',
    )
  })
})

describe('detectarDesdobramentos', () => {
  /** Base com o preço caindo de 1000 para 100 em 01/04 e as cotas informadas */
  function base(cotasAntes: number, cotasDepois: number): MarketDatabase {
    const db = new MarketDatabase(':memory:')
    db.inserirPrecos(
      diasUteis('2024-02-01', '2024-05-31').map((data) => ({
        ativoId: ISIN,
        data,
        ticker: 'TEST11',
        codbdi: '12',
        nome: 'FII TESTE',
        fechamento: data < '2024-04-01' ? 1000 : 101,
        volume: 1_000_000,
        negocios: 10,
      })),
    )
    db.substituirCvm('inf_mensal_fii_geral', 2024, [
      cvm('inf_mensal_fii_geral', '2024-02-01', 1, '2024-03-15', {
        Codigo_ISIN: ISIN,
      }),
    ])
    db.substituirCvm('inf_mensal_fii_complemento', 2024, [
      cvm('inf_mensal_fii_complemento', '2024-02-01', 1, '2024-03-15', {
        Cotas_Emitidas: String(cotasAntes),
      }),
      cvm('inf_mensal_fii_complemento', '2024-04-01', 1, '2024-05-15', {
        Cotas_Emitidas: String(cotasDepois),
      }),
    ])
    return db
  }

  test('salto de preço com as cotas multiplicadas vira desdobramento', () => {
    const db = base(1_000_000, 10_000_000)
    detectarDesdobramentos(db, silencioso)
    expect(new FiiHistoricalProvider(db).eventos(ISIN)).toMatchObject([
      { data: '2024-04-01', tipo: 'desdobramento', fator: 10 },
    ])
  })

  test('queda de preço sem mudança nas cotas não é desdobramento', () => {
    const db = base(1_000_000, 1_000_000)
    detectarDesdobramentos(db, silencioso)
    expect(new FiiHistoricalProvider(db).eventos(ISIN)).toEqual([])
  })
})
