import { describe, expect, test } from 'bun:test'

import { buildCvmFundos } from '../../src/sources/cvm/build'
import {
  classificarRegioes,
  listarGestoras,
} from '../../src/sources/cvm/regioes'
import type { Municipio } from '../../src/sources/ibge'
import type { CvmFundo, CvmImovel } from '../../src/types/cvm.type'
import { CidadeResolver } from '../../src/utils/Cidades'
import { extractSpreadCredito } from '../../src/utils/FiiIndicators'
import FiiQualidade from '../../src/utils/FiiQualidade'

const municipio = (
  id: number,
  nome: string,
  uf: string,
  extra: Partial<Municipio> = {},
): Municipio => ({
  id,
  nome,
  uf,
  populacao: 50_000,
  metropoleCapital: false,
  ...extra,
})

const MUNICIPIOS = [
  municipio(1, 'Extrema', 'MG'),
  municipio(2, 'Barueri', 'SP', { metropoleCapital: true }),
  municipio(3, 'São Paulo', 'SP', { metropoleCapital: true }),
  municipio(4, 'Itajaí', 'SC'),
  municipio(5, 'Quadra', 'SP'),
  municipio(6, 'Bom Jesus', 'PI'),
  municipio(7, 'Bom Jesus', 'RS'),
  municipio(8, 'Pelotas', 'RS', { populacao: 325_000 }),
  municipio(9, 'Campinas', 'SP', { populacao: 1_140_000 }),
]

describe('CidadeResolver', () => {
  const resolver = new CidadeResolver(MUNICIPIOS)
  const cidade = (endereco: string) => {
    const found = resolver.resolve(endereco)
    return found ? `${found.nome}/${found.uf}` : null
  }

  test('lê "Cidade/UF" e "Cidade - UF", sem acento e em maiúsculas', () => {
    expect(cidade('Rua Josepha Gomes, Galpão 01 - Extrema/MG')).toBe(
      'Extrema/MG',
    )
    expect(cidade('Av. Paulista, 1000, SAO PAULO - SP, 01310-100')).toBe(
      'São Paulo/SP',
    )
  })

  test('UF errada vale se o nome for único no país', () => {
    expect(cidade('Bairro Cordeiros, Itajai/SP')).toBe('Itajaí/SC')
  })

  test('sem UF, aceita um trecho que seja só o nome da cidade', () => {
    expect(cidade('Avenida Piracema, 155, Tamboré, Barueri')).toBe('Barueri/SP')
  })

  test('nome dentro de rua ou bairro não conta', () => {
    expect(cidade('Av. Goiás, 980 - Quadra 14')).toBeNull()
    expect(cidade('Rua Pelotas Neto, 40')).toBeNull()
  })

  test('nome em mais de uma UF sem UF no endereço é null', () => {
    expect(cidade('Rodovia BR-101, km 5, Bom Jesus')).toBeNull()
  })
})

describe('buildCvmFundos: imóveis, carteira e composição', () => {
  const resolver = new CidadeResolver(MUNICIPIOS)
  const csvs = {
    inf_mensal_fii_geral: [
      'CNPJ_Fundo_Classe;Data_Referencia;Versao;Codigo_ISIN;Segmento_Atuacao\n' +
        '11.111.111/0001-11;2026-06-01;1;BRTESTCTF001;Logística\n',
    ],
    inf_mensal_fii_complemento: [
      'CNPJ_Fundo_Classe;Data_Referencia;Versao;Patrimonio_Liquido;Valor_Ativo\n' +
        '11.111.111/0001-11;2026-06-01;1;1000;1100\n',
    ],
    inf_mensal_fii_ativo_passivo: [
      'CNPJ_Fundo_Classe;Data_Referencia;Versao;Direitos_Bens_Imoveis;Acoes_Sociedades_Atividades_FII;CRI;CRI_CRA;FII\n' +
        '11.111.111/0001-11;2026-06-01;1;700;50;;100;30\n',
    ],
    inf_trimestral_fii_imovel: [
      'CNPJ_Fundo_Classe;Data_Referencia;Versao;Classe;Nome_Imovel;Endereco;Area;Percentual_Vacancia;Percentual_Receitas_FII\n' +
        // Informe antigo e versão antiga ficam de fora
        '11.111.111/0001-11;2026-03-31;1;Imóveis para renda acabados;VELHO;Extrema/MG;10;0;0\n' +
        '11.111.111/0001-11;2026-06-30;1;Imóveis para renda acabados;V1;Extrema/MG;10;0;0\n' +
        '11.111.111/0001-11;2026-06-30;2;Imóveis para renda acabados;GALPAO;Rua A, 1 - Extrema/MG;1000;0.1;0.6\n' +
        // Percentual em vez de fração
        '11.111.111/0001-11;2026-06-30;2;Imóveis para venda em construção;LOTE;Rua B, Tamboré, Barueri;500;;40\n',
    ],
    inf_trimestral_fii_ativo: [
      'CNPJ_Fundo_Classe;Data_Referencia;Versao;Tipo;Valor\n' +
        '11.111.111/0001-11;2026-06-30;1;CRI/CRA;60\n' +
        '11.111.111/0001-11;2026-06-30;1;CRI/CRA;40\n' +
        '11.111.111/0001-11;2026-06-30;1;FII;30\n' +
        '11.111.111/0001-11;2026-06-30;1;Ações;99\n',
    ],
  }

  const fundo = buildCvmFundos(csvs, (endereco) =>
    resolver.resolve(endereco),
  ).get('11111111000111')

  test('guarda o segmento de atuação e a composição do ativo', () => {
    expect(fundo?.segmentoAtuacao).toBe('Logística')
    expect(fundo?.composicao).toEqual({
      data: '2026-06-01',
      imoveis: 750,
      cri: 100,
      fii: 30,
    })
  })

  test('usa só o informe trimestral mais recente, na última versão', () => {
    expect(fundo?.imoveisData).toBe('2026-06-30')
    expect(fundo?.imoveis).toEqual([
      {
        nome: 'GALPAO',
        endereco: 'Rua A, 1 - Extrema/MG',
        classe: 'renda_acabado',
        area: 1000,
        receita: 0.6,
        vacancia: 0.1,
        cidade: 'Extrema/MG',
        municipioId: 1,
        uf: 'MG',
        boaLocalizacao: null,
      },
      {
        nome: 'LOTE',
        endereco: 'Rua B, Tamboré, Barueri',
        classe: 'venda_construcao',
        area: 500,
        receita: 0.4,
        vacancia: null,
        cidade: 'Barueri/SP',
        municipioId: 2,
        uf: 'SP',
        boaLocalizacao: null,
      },
    ])
  })

  test('resume CRIs e FIIs com o patrimônio do mês do trimestre', () => {
    expect(fundo?.carteira).toEqual({
      data: '2026-06-30',
      patrimonio: 1000,
      cri: { quantidade: 2, total: 100, maior: 60 },
      fii: { quantidade: 1, total: 30, maior: 30 },
    })
  })
})

function imovel(overrides: Partial<CvmImovel> = {}): CvmImovel {
  return {
    nome: 'X',
    endereco: '',
    classe: 'renda_acabado',
    area: 100,
    receita: 0.1,
    vacancia: 0,
    cidade: 'Extrema/MG',
    municipioId: 1,
    uf: 'MG',
    boaLocalizacao: null,
    ...overrides,
  }
}

function fundo(overrides: Partial<CvmFundo> = {}): CvmFundo {
  return {
    cnpj: '1',
    isin: null,
    gestora: null,
    segmentoAtuacao: 'Logística',
    patrimonio: [],
    trimestres: [],
    endividamento: null,
    imoveis: [],
    imoveisData: '2026-06-30',
    carteira: null,
    composicao: null,
    ...overrides,
  }
}

describe('classificarRegioes', () => {
  // Extrema: 3 galpões de 2 fundos com vacância 0, 0 e 0,03 (média 1%);
  // mercado de logística: média dos 5 galpões = (0+0+0,03+0,2+0,2)/5 = 8,6%
  const fundos = () => [
    fundo({
      cnpj: 'A',
      imoveis: [
        imovel({ vacancia: 0, receita: 0.5 }),
        imovel({ vacancia: 0.03, receita: 0.5 }),
      ],
    }),
    fundo({
      cnpj: 'B',
      imoveis: [
        imovel({ vacancia: 0, receita: 0.3 }),
        imovel({
          vacancia: 0.2,
          receita: 0.3,
          cidade: 'Pelotas/RS',
          municipioId: 8,
          uf: 'RS',
        }),
        imovel({
          vacancia: 0.2,
          receita: 0.4,
          cidade: 'Campinas/SP',
          municipioId: 9,
          uf: 'SP',
        }),
      ],
    }),
    // Informa tudo zerado: não entra na média, mas é classificado
    fundo({
      cnpj: 'C',
      imoveis: [
        imovel({
          vacancia: 0,
          receita: 0,
          cidade: 'Barueri/SP',
          municipioId: 2,
          uf: 'SP',
        }),
      ],
    }),
  ]

  test('cidade com imóveis suficientes compara com o mercado do tipo', () => {
    const lista = fundos()
    const regioes = classificarRegioes(lista, MUNICIPIOS)
    const extrema = regioes.find((r) => r.cidade === 'Extrema')

    expect(extrema).toEqual({
      tipo: 'Logística',
      cidade: 'Extrema',
      uf: 'MG',
      municipioId: 1,
      imoveis: 3,
      fundos: 2,
      vacanciaMedia: 1,
      vacanciaMercado: 8.6,
      boa: true,
      fonte: 'vacancia_tipo',
    })
    expect(lista[0].imoveis[0].boaLocalizacao).toBe(true)
  })

  test('sem imóveis suficientes usa o IBGE (metrópole ou população)', () => {
    const lista = fundos()
    const regioes = classificarRegioes(lista, MUNICIPIOS)
    const porCidade = (nome: string) => regioes.find((r) => r.cidade === nome)

    // Região metropolitana de capital
    expect(porCidade('Barueri')).toMatchObject({ boa: true, fonte: 'ibge' })
    // Mais de 500 mil habitantes
    expect(porCidade('Campinas')).toMatchObject({ boa: true, fonte: 'ibge' })
    // Nem uma coisa nem outra
    expect(porCidade('Pelotas')).toMatchObject({ boa: false, fonte: 'ibge' })
    expect(lista[1].imoveis[1].boaLocalizacao).toBe(false)
  })
})

describe('FiiQualidade.diversificacao', () => {
  const galpoes = (n: number, overrides: Partial<CvmImovel> = {}) =>
    Array.from({ length: n }, (_, i) =>
      imovel({
        nome: `G${i}`,
        uf: i % 2 ? 'SP' : 'MG',
        receita: 1 / n,
        ...overrides,
      }),
    )

  test('tijolo com 5 imóveis, 20% cada e 2 estados é diversificado', () => {
    const resultado = FiiQualidade.diversificacao(
      'Tijolo',
      fundo({ imoveis: galpoes(5) }),
    )

    expect(resultado.diversificado).toBe(true)
    expect(resultado.classe).toBe('imoveis')
    expect(resultado.criterios).toEqual([
      {
        criterio: 'quantidade_imoveis',
        valor: 5,
        limite: 5,
        tipo: 'minimo',
        ok: true,
      },
      {
        criterio: 'maior_participacao_imovel',
        valor: 20,
        limite: 30,
        tipo: 'maximo',
        ok: true,
        base: 'receita',
      },
      { criterio: 'estados', valor: 2, limite: 2, tipo: 'minimo', ok: true },
    ])
  })

  test('um imóvel com receita demais reprova', () => {
    const imoveis = galpoes(6)
    imoveis[0].receita = 5
    const resultado = FiiQualidade.diversificacao('Tijolo', fundo({ imoveis }))

    expect(resultado.diversificado).toBe(false)
    expect(resultado.criterios[1].valor).toBe(85.71)
  })

  test('sem receita informada usa a área', () => {
    const imoveis = galpoes(5, { receita: 0 })
    imoveis[0].area = 400
    const resultado = FiiQualidade.diversificacao('Tijolo', fundo({ imoveis }))

    expect(resultado.criterios[1]).toMatchObject({
      valor: 50,
      base: 'area',
      ok: false,
    })
  })

  test('um estado só, com imóveis sem cidade, fica incerto', () => {
    const imoveis = galpoes(5, { uf: 'MG' })
    imoveis[4].uf = null
    const resultado = FiiQualidade.diversificacao('Tijolo', fundo({ imoveis }))

    expect(resultado.criterios[2].ok).toBeNull()
    expect(resultado.diversificado).toBeNull()
  })

  test('papel: quantidade de CRIs e maior CRI sobre o PL', () => {
    const carteira = {
      data: '2026-06-30',
      patrimonio: 1000,
      cri: { quantidade: 12, total: 900, maior: 200 },
      fii: { quantidade: 0, total: 0, maior: 0 },
    }
    const resultado = FiiQualidade.diversificacao('Papel', fundo({ carteira }))

    expect(resultado.diversificado).toBe(false)
    expect(resultado.criterios).toEqual([
      {
        criterio: 'quantidade_cri',
        valor: 12,
        limite: 10,
        tipo: 'minimo',
        ok: true,
      },
      {
        criterio: 'maior_cri_sobre_pl',
        valor: 20,
        limite: 15,
        tipo: 'maximo',
        ok: false,
      },
    ])
  })

  test('FoF usa a carteira de FIIs', () => {
    const carteira = {
      data: '2026-06-30',
      patrimonio: 1000,
      cri: { quantidade: 0, total: 0, maior: 0 },
      fii: { quantidade: 15, total: 900, maior: 150 },
    }
    const resultado = FiiQualidade.diversificacao('FoF', fundo({ carteira }))

    expect(resultado.classe).toBe('fii')
    expect(resultado.diversificado).toBe(true)
  })

  test('híbrido usa a classe com mais dinheiro', () => {
    const composicao = { data: '2026-06-01', imoveis: 10, cri: 500, fii: 20 }
    const resultado = FiiQualidade.diversificacao(
      'Híbrido',
      fundo({ composicao }),
    )

    expect(resultado.classe).toBe('cri')
    // Sem carteira informada não dá para avaliar
    expect(resultado.diversificado).toBeNull()
  })

  test('sem dados da CVM é null', () => {
    expect(FiiQualidade.diversificacao('Tijolo', null).diversificado).toBeNull()
  })
})

describe('FiiQualidade.localizacao', () => {
  test('60% da área em cidades boas é boa localização', () => {
    const resultado = FiiQualidade.localizacao(
      'Tijolo',
      fundo({
        imoveis: [
          imovel({ area: 600, boaLocalizacao: true }),
          imovel({ area: 300, boaLocalizacao: false }),
          // Sem cidade: fica fora da conta da área boa
          imovel({ area: 100, boaLocalizacao: null }),
        ],
      }),
    )

    expect(resultado.boa_localizacao).toBe(true)
    expect(resultado.percentual_area_boa).toBe(66.67)
    expect(resultado.percentual_area_classificada).toBe(90)
  })

  test('pouca área classificada é null', () => {
    const resultado = FiiQualidade.localizacao(
      'Tijolo',
      fundo({
        imoveis: [
          imovel({ area: 400, boaLocalizacao: true }),
          imovel({ area: 600, boaLocalizacao: null }),
        ],
      }),
    )

    expect(resultado.boa_localizacao).toBeNull()
    expect(resultado.percentual_area_classificada).toBe(40)
  })

  test('papel e FoF não têm localização', () => {
    const comImoveis = fundo({ imoveis: [imovel({ boaLocalizacao: true })] })
    expect(
      FiiQualidade.localizacao('Papel', comImoveis).boa_localizacao,
    ).toBeNull()
  })
})

describe('listarGestoras', () => {
  test('conta os fundos por CNPJ e ordena do maior para o menor', () => {
    const gestora = (cnpj: string, nome: string) => ({ cnpj, nome })
    expect(
      listarGestoras([
        fundo({ gestora: gestora('1', 'B') }),
        fundo({ gestora: gestora('2', 'A') }),
        fundo({ gestora: gestora('2', 'A') }),
        fundo({ gestora: gestora('', 'Sem CNPJ') }),
        fundo(),
      ]),
    ).toEqual([
      { cnpj: '2', nome: 'A', fundos: 2 },
      { cnpj: '1', nome: 'B', fundos: 1 },
    ])
  })
})

describe('extractSpreadCredito', () => {
  // Trechos reais de relatórios gerenciais (MXRF11, RBRR11, CPTS11, BTCI11)
  test('lê o spread médio em % ou bps', () => {
    expect(
      extractSpreadCredito(
        'Spread de Crédito 148 bps* (Book de CRIs + Permutas) LTV médio 56%',
      ),
    ).toBe('1,48%')
    expect(
      extractSpreadCredito(
        'prazo médio de 3,8 anos e spread médio de 1,5% a.a. e (ii)',
      ),
    ).toBe('1,50%')
  })

  test('ignora o spread de uma compra do mês', () => {
    expect(
      extractSpreadCredito(
        'compra de CRIs a uma taxa média de IPCA + 10,98%, spread de 2,10%. ' +
          'A carteira possui spread médio de 0,90%; taxa nominal média',
      ),
    ).toBe('0,90%')
  })

  test('taxa com indexador não é spread', () => {
    expect(
      extractSpreadCredito('SPREAD Médio (MTM) a.a. IPCA + 10,15% 2% 2%'),
    ).toBeNull()
  })

  test('sem spread médio no relatório é null', () => {
    expect(
      extractSpreadCredito('Subordinação; Excesso de Spread; Fundo de reserva'),
    ).toBeNull()
  })
})
