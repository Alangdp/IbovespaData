import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setSystemTime,
  test,
} from 'bun:test'

import { buildCvmFundos } from '../../src/sources/cvm/build'
import { parseCsv } from '../../src/sources/cvm/csv'
import type { CvmFundo } from '../../src/types/cvm.type'
import FiiIndicators, { extractLtvMedio } from '../../src/utils/FiiIndicators'

describe('parseCsv', () => {
  test('separa por ponto e vírgula e aceita CRLF', () => {
    expect(parseCsv('A;B\r\n1;2\r\n3;4\r\n')).toEqual([
      { A: '1', B: '2' },
      { A: '3', B: '4' },
    ])
  })

  test('campo entre aspas pode ter ponto e vírgula e aspas escapadas', () => {
    expect(parseCsv('A;B\n"x;y";"diz ""oi"""\n')).toEqual([
      { A: 'x;y', B: 'diz "oi"' },
    ])
  })

  test('aspas no meio do texto são literais', () => {
    expect(parseCsv('A;B\nPolegada 5" larga;2\n')).toEqual([
      { A: 'Polegada 5" larga', B: '2' },
    ])
  })
})

describe('buildCvmFundos', () => {
  const csvs = {
    inf_mensal_fii_geral: [
      'CNPJ_Fundo_Classe;Data_Referencia;Versao;Codigo_ISIN\n' +
        '11.111.111/0001-11;2026-01-01;1;BRTESTCTF001\n',
    ],
    inf_mensal_fii_complemento: [
      'CNPJ_Fundo_Classe;Data_Referencia;Versao;Patrimonio_Liquido;Valor_Ativo\n' +
        '11.111.111/0001-11;2026-01-01;1;1000;1500\n' +
        '11.111.111/0001-11;2026-01-01;2;1200;2000\n',
    ],
    inf_mensal_fii_ativo_passivo: [
      'CNPJ_Fundo_Classe;Data_Referencia;Versao;Obrigacoes_Securitizacao_Recebiveis;Obrigacoes_Aquisicao_Imoveis\n' +
        '11.111.111/0001-11;2026-01-01;1;300;100\n',
    ],
    inf_trimestral_fii_resultado_contabil_financeiro: [
      'CNPJ_Fundo_Classe;Data_Referencia;Versao;Taxa_Administracao_Contabil;Taxa_Administracao_Financeiro;Resultado_Financeiro_Liquido_Acumulado;Resultado_Financeiro_Liquido_Acumulado_95;Rendimentos_Declarados\n' +
        '11.111.111/0001-11;2026-03-31;1;-5;0;50;47.5;0\n' +
        '11.111.111/0001-11;2026-06-30;1;-8;-9;100;95;96\n',
    ],
    inf_anual_fii_complemento: [
      'CNPJ_Fundo_Classe;Data_Referencia;Versao;Nome_Gestor;CNPJ_Gestor\n' +
        '11.111.111/0001-11;2025-12-01;1;"GESTORA ""X"" LTDA";22.222.222/0001-22\n',
    ],
  }

  test('consolida um registro por CNPJ com a versão mais recente', () => {
    const fundo = buildCvmFundos(csvs).get('11111111000111')

    expect(fundo).toEqual({
      cnpj: '11111111000111',
      isin: 'BRTESTCTF001',
      gestora: { nome: 'GESTORA "X" LTDA', cnpj: '22222222000122' },
      patrimonio: [{ data: '2026-01-01', valor: 1200 }],
      trimestres: [
        {
          data: '2026-03-31',
          // Financeiro zerado usa o contábil
          taxaAdministracao: 5,
          resultadoSemestre: null,
          resultadoSemestre95: null,
          rendimentosDeclarados: null,
        },
        {
          data: '2026-06-30',
          taxaAdministracao: 9,
          resultadoSemestre: 100,
          resultadoSemestre95: 95,
          rendimentosDeclarados: 96,
        },
      ],
      endividamento: { data: '2026-01-01', obrigacoes: 400, ativo: 2000 },
      segmentoAtuacao: null,
      imoveis: [],
      imoveisData: null,
      carteira: null,
      composicao: { data: '2026-01-01', imoveis: 0, cri: 0, fii: 0 },
    })
  })
})

function fundo(overrides: Partial<CvmFundo> = {}): CvmFundo {
  return {
    cnpj: '1',
    isin: null,
    gestora: null,
    patrimonio: [
      { data: '2026-01-01', valor: 1000 },
      { data: '2026-02-01', valor: 1000 },
      { data: '2026-03-01', valor: 1000 },
      { data: '2026-04-01', valor: 2000 },
      { data: '2026-05-01', valor: 2000 },
      { data: '2026-06-01', valor: 2000 },
    ],
    trimestres: [
      {
        data: '2026-03-31',
        taxaAdministracao: 2.5,
        resultadoSemestre: null,
        resultadoSemestre95: null,
        rendimentosDeclarados: null,
      },
      {
        data: '2026-06-30',
        taxaAdministracao: 10,
        resultadoSemestre: 100,
        resultadoSemestre95: 95,
        rendimentosDeclarados: 94,
      },
    ],
    endividamento: { data: '2026-06-01', obrigacoes: 250, ativo: 1000 },
    segmentoAtuacao: null,
    imoveis: [],
    imoveisData: null,
    carteira: null,
    composicao: null,
    ...overrides,
  }
}

describe('FiiIndicators.taxaAdministracao', () => {
  test('anualiza a taxa de cada trimestre pelo PL médio do trimestre', () => {
    expect(FiiIndicators.taxaPorTrimestre(fundo())).toEqual([
      {
        trimestre: '2026-03-31',
        taxa_paga: 2.5,
        patrimonio_medio: 1000,
        percentual_anualizado: 1,
      },
      {
        trimestre: '2026-06-30',
        taxa_paga: 10,
        patrimonio_medio: 2000,
        percentual_anualizado: 2,
      },
    ])
    expect(FiiIndicators.taxaAdministracao(fundo())).toBe(1.5)
  })

  test('trimestre sem PL positivo fica de fora', () => {
    const semPl = fundo({ patrimonio: [{ data: '2026-06-01', valor: 0 }] })
    expect(FiiIndicators.taxaAdministracao(semPl)).toBeNull()
  })

  test('sem dados da CVM é null', () => {
    expect(FiiIndicators.taxaAdministracao(null)).toBeNull()
  })
})

describe('FiiIndicators.alavancagem', () => {
  test('obrigações sobre o ativo total, em %', () => {
    expect(FiiIndicators.alavancagem(fundo())).toBe(25)
  })

  test('sem mês com ativo informado é null', () => {
    expect(FiiIndicators.alavancagem(fundo({ endividamento: null }))).toBeNull()
    expect(FiiIndicators.alavancagem(null)).toBeNull()
  })
})

describe('FiiIndicators.limiteDistribuicao', () => {
  test('distribuir menos de 95% do resultado não respeita o limite', () => {
    expect(FiiIndicators.limiteDistribuicao(fundo())).toEqual({
      respeitado: false,
      percentual_distribuido: 94,
    })
  })

  test('sem resultado positivo não há mínimo a cumprir', () => {
    const prejuizo = fundo()
    prejuizo.trimestres[1].resultadoSemestre = -10
    expect(FiiIndicators.limiteDistribuicao(prejuizo)).toEqual({
      respeitado: true,
      percentual_distribuido: null,
    })
  })

  test('sem semestre informado é null', () => {
    expect(FiiIndicators.limiteDistribuicao(fundo({ trimestres: [] }))).toEqual(
      { respeitado: null, percentual_distribuido: null },
    )
  })
})

describe('FiiIndicators.dividendoExtraordinario', () => {
  beforeAll(() => {
    setSystemTime(new Date('2026-09-23T12:00:00Z'))
  })
  afterAll(() => {
    setSystemTime()
  })

  const pagamento = (
    dataPagamento: string,
    valor: number,
    tipo = 'Rendimento',
  ) => ({
    dataPagamento,
    valor,
    tipo,
  })

  test('pagamento acima de 1,5x a mediana é extraordinário', () => {
    expect(
      FiiIndicators.dividendoExtraordinario([
        pagamento('15/07/2026', 1),
        pagamento('15/08/2026', 1.6),
        pagamento('15/09/2026', 1),
      ]),
    ).toBe(true)
  })

  test('variação normal e pagamentos antigos ou amortizações não contam', () => {
    expect(
      FiiIndicators.dividendoExtraordinario([
        pagamento('15/01/2020', 9),
        pagamento('15/07/2026', 1),
        pagamento('15/08/2026', 1.2),
        pagamento('20/08/2026', 5, 'Amortização'),
        pagamento('15/09/2026', 1),
      ]),
    ).toBe(false)
  })

  test('menos de 3 rendimentos no ano é null', () => {
    expect(
      FiiIndicators.dividendoExtraordinario([pagamento('15/09/2026', 1)]),
    ).toBeNull()
  })
})

describe('extractLtvMedio', () => {
  // Trechos reais de relatórios gerenciais (MXRF11, CPTS11 e RECR11)
  test('lê o LTV médio da carteira', () => {
    expect(
      extractLtvMedio(
        'Spread de Crédito 148 bps* (Book de CRIs + Permutas) LTV médio 56% *Considerando o MtM',
      ),
    ).toBe(56)
    expect(extractLtvMedio('LTV médio ponderado: 57,20%')).toBe(57.2)
    expect(extractLtvMedio('LTV consolidado da carteira 48,5%')).toBe(48.5)
  })

  test('ignora limites e o LTV de cada CRI', () => {
    expect(
      extractLtvMedio(
        'AF das unidades, com LTV médio inferior a 40% e máximo de 60%; (i) AF de imóveis (LTV de 71%)',
      ),
    ).toBeNull()
  })

  test('usa a primeira ocorrência válida', () => {
    expect(
      extractLtvMedio('LTV médio inferior a 40%. Carteira: LTV médio 52%'),
    ).toBe(52)
  })

  test('sem LTV médio no relatório é null', () => {
    expect(
      extractLtvMedio('Alocação por LTV vs. rating internacional'),
    ).toBeNull()
  })
})
