import type { FeatureDef } from '../core/features.js'
import { alertasFii } from './alertas.js'
import type { FiiSnapshot } from './FiiHistoricalProvider.js'

/** Regras de "conhecida em" reaproveitadas */
const PREGAO_ANTERIOR = 'fechamento do pregão anterior à data'
const INFORME_MENSAL =
  'informe mensal da CVM entregue antes da data (versão válida no dia)'
const INFORME_TRIMESTRAL =
  'informe trimestral da CVM entregue antes da data (versão válida no dia)'
const PROVENTOS = 'proventos com data-com antes da data'
const MACRO = 'último valor divulgado antes da data'

/**
 * Features de FII do dataset, na ordem das colunas
 *
 * Todas vêm do `FiiSnapshot` da data, que só usa informação conhecida antes
 * dela (ver `PointInTimeView`)
 */
export const FII_FEATURES: FeatureDef<FiiSnapshot>[] = [
  // Identificação
  {
    nome: 'cnpj',
    grupo: 'Identificação',
    descricao: 'CNPJ do fundo (só dígitos)',
    tipo: 'texto',
    unidade: '',
    fonte: 'CVM (ISIN do COTAHIST -> informe mensal)',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.cnpj,
  },
  {
    nome: 'nome',
    grupo: 'Identificação',
    descricao: 'Nome do fundo na CVM',
    tipo: 'texto',
    unidade: '',
    fonte: 'CVM, informe mensal (geral)',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.nome,
  },
  {
    nome: 'segmento',
    grupo: 'Identificação',
    descricao:
      'Classe pela composição do ativo: Tijolo, Papel, FoF (a classe com 60%+ do dinheiro) ou Híbrido',
    tipo: 'texto',
    unidade: '',
    fonte: 'CVM, informe mensal (ativo/passivo)',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.segmento,
  },
  {
    nome: 'segmento_atuacao',
    grupo: 'Identificação',
    descricao: 'Segmento declarado pelo fundo (Logística, Shoppings, Lajes...)',
    tipo: 'texto',
    unidade: '',
    fonte: 'CVM, informe mensal (geral)',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.segmentoAtuacao,
  },
  {
    nome: 'mandato',
    grupo: 'Identificação',
    descricao: 'Mandato declarado (Renda, Títulos e Valores Mobiliários...)',
    tipo: 'texto',
    unidade: '',
    fonte: 'CVM, informe mensal (geral)',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.mandato,
  },
  {
    nome: 'tipo_gestao',
    grupo: 'Identificação',
    descricao: 'Gestão Ativa ou Passiva',
    tipo: 'texto',
    unidade: '',
    fonte: 'CVM, informe mensal (geral)',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.tipoGestao,
  },
  {
    nome: 'idade_anos',
    grupo: 'Identificação',
    descricao:
      'Anos desde o início do funcionamento (CVM); sem ele, desde a 1ª negociação na base (que começa em 2016)',
    tipo: 'numero',
    unidade: 'anos',
    fonte: 'CVM (Data_Funcionamento) ou COTAHIST',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.idadeAnos,
  },

  // Mercado
  {
    nome: 'preco',
    grupo: 'Mercado',
    descricao: 'Fechamento do último pregão antes da data (sem ajuste)',
    tipo: 'numero',
    unidade: 'R$',
    fonte: 'B3, COTAHIST',
    conhecido: PREGAO_ANTERIOR,
    valor: (s) => s.preco,
  },
  {
    nome: 'liquidez_media',
    grupo: 'Mercado',
    descricao:
      'Volume financeiro médio dos últimos 60 pregões (dias sem negócio contam zero)',
    tipo: 'numero',
    unidade: 'R$/dia',
    fonte: 'B3, COTAHIST',
    conhecido: PREGAO_ANTERIOR,
    valor: (s) => s.liquidezMedia,
  },
  ...(
    [
      ['retorno_1m', 'retorno1m', '1 mês (30 dias)'],
      ['retorno_3m', 'retorno3m', '3 meses (91 dias)'],
      ['retorno_6m', 'retorno6m', '6 meses (182 dias)'],
      ['retorno_12m', 'retorno12m', '12 meses (365 dias)'],
    ] as const
  ).map(
    ([nome, campo, janela]): FeatureDef<FiiSnapshot> => ({
      nome,
      grupo: 'Mercado',
      descricao: `Retorno total (preço + proventos, sem reinvestir) em ${janela}, ajustado por desdobramento (momentum)`,
      tipo: 'numero',
      unidade: '%',
      fonte: 'B3 + proventos',
      conhecido: PREGAO_ANTERIOR,
      valor: (s) => s[campo],
    }),
  ),
  {
    nome: 'volatilidade_3m',
    grupo: 'Mercado',
    descricao:
      'Desvio padrão anualizado (x raiz de 252) dos retornos diários de preço em 3 meses; mínimo de 20 retornos',
    tipo: 'numero',
    unidade: '% a.a.',
    fonte: 'B3, COTAHIST',
    conhecido: PREGAO_ANTERIOR,
    valor: (s) => s.volatilidade3m,
  },
  {
    nome: 'volatilidade_12m',
    grupo: 'Mercado',
    descricao: 'Como `volatilidade_3m`, em 12 meses',
    tipo: 'numero',
    unidade: '% a.a.',
    fonte: 'B3, COTAHIST',
    conhecido: PREGAO_ANTERIOR,
    valor: (s) => s.volatilidade12m,
  },
  {
    nome: 'queda_do_topo_12m',
    grupo: 'Mercado',
    descricao:
      'Preço atual em relação ao maior preço de 12 meses (0 = no topo; negativo = abaixo)',
    tipo: 'numero',
    unidade: '%',
    fonte: 'B3, COTAHIST',
    conhecido: PREGAO_ANTERIOR,
    valor: (s) => s.quedaDoTopo12m,
  },

  // Proventos
  {
    nome: 'dy_12m',
    grupo: 'Proventos',
    descricao:
      'Rendimentos dos últimos 12 meses (sem amortizações) / preço, na base de cotas atual',
    tipo: 'numero',
    unidade: '%',
    fonte: 'statusinvest (ou estimado pela CVM)',
    conhecido: PROVENTOS,
    valor: (s) => s.dy12m,
  },
  {
    nome: 'amortizacao_12m',
    grupo: 'Proventos',
    descricao:
      'Amortizações (devolução de capital) dos últimos 12 meses / preço',
    tipo: 'numero',
    unidade: '%',
    fonte: 'statusinvest',
    conhecido: PROVENTOS,
    valor: (s) => s.amortizacao12m,
  },
  {
    nome: 'variacao_dividendos',
    grupo: 'Proventos',
    descricao:
      'Coeficiente de variação dos rendimentos de 12 meses (desvio / média); menor = mais estável; mínimo de 6 pagamentos',
    tipo: 'numero',
    unidade: '',
    fonte: 'statusinvest',
    conhecido: PROVENTOS,
    valor: (s) => s.variacaoDividendos,
  },
  {
    nome: 'crescimento_dividendos',
    grupo: 'Proventos',
    descricao: 'Rendimentos dos últimos 6 meses / dos 6 anteriores - 1',
    tipo: 'numero',
    unidade: '%',
    fonte: 'statusinvest',
    conhecido: PROVENTOS,
    valor: (s) => s.crescimentoDividendos,
  },
  {
    nome: 'meses_com_provento_12m',
    grupo: 'Proventos',
    descricao: 'Meses distintos com rendimento nos últimos 12',
    tipo: 'numero',
    unidade: 'meses',
    fonte: 'statusinvest',
    conhecido: PROVENTOS,
    valor: (s) => s.mesesComProvento12m,
  },
  {
    nome: 'fonte_proventos',
    grupo: 'Proventos',
    descricao:
      'statusinvest (valor real) ou cvm_estimado (DY do mês x VP da cota, aproximado)',
    tipo: 'texto',
    unidade: '',
    fonte: '-',
    conhecido: PROVENTOS,
    valor: (s) => s.fonteProventos,
  },

  // Fundamentos
  {
    nome: 'vp_cota',
    grupo: 'Fundamentos',
    descricao: 'Valor patrimonial por cota, na base de cotas atual',
    tipo: 'numero',
    unidade: 'R$',
    fonte: 'CVM, informe mensal',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.vpCota,
  },
  {
    nome: 'pvp',
    grupo: 'Fundamentos',
    descricao: 'Preço / valor patrimonial por cota',
    tipo: 'numero',
    unidade: '',
    fonte: 'B3 + CVM',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.pvp,
  },
  {
    nome: 'variacao_vp_12m',
    grupo: 'Fundamentos',
    descricao: 'Variação do VP da cota em 12 meses, ajustada por desdobramento',
    tipo: 'numero',
    unidade: '%',
    fonte: 'CVM, informe mensal',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.variacaoVp12m,
  },
  {
    nome: 'taxa_administracao',
    grupo: 'Fundamentos',
    descricao:
      'Despesa com taxa de administração (adm + gestão) / PL médio, média dos últimos 4 trimestres anualizados',
    tipo: 'numero',
    unidade: '% a.a.',
    fonte: 'CVM, informe trimestral + mensal',
    conhecido: INFORME_TRIMESTRAL,
    valor: (s) => s.taxaAdministracao,
  },
  {
    nome: 'alavancagem',
    grupo: 'Fundamentos',
    descricao:
      'Obrigações por securitização e por aquisição de imóveis / ativo total',
    tipo: 'numero',
    unidade: '%',
    fonte: 'CVM, informe mensal',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.alavancagem,
  },
  {
    nome: 'vacancia',
    grupo: 'Fundamentos',
    descricao:
      'Vacância média dos imóveis de renda prontos, pesada pela área (só Tijolo e Híbrido)',
    tipo: 'numero',
    unidade: '%',
    fonte: 'CVM, informe trimestral',
    conhecido: INFORME_TRIMESTRAL,
    valor: (s) => s.vacancia,
  },
  {
    nome: 'diversificado',
    grupo: 'Fundamentos',
    descricao:
      'Regra de diversificação da classe (ver src/config/fiiCriterios.ts); null = falta dado',
    tipo: 'booleano',
    unidade: '',
    fonte: 'CVM, informe trimestral',
    conhecido: INFORME_TRIMESTRAL,
    valor: (s) => s.diversificado,
  },
  {
    nome: 'limite_distribuicao',
    grupo: 'Fundamentos',
    descricao: 'Distribuiu ao menos 95% do resultado do último semestre',
    tipo: 'booleano',
    unidade: '',
    fonte: 'CVM, informe trimestral',
    conhecido: INFORME_TRIMESTRAL,
    valor: (s) => s.limiteDistribuicao,
  },
  {
    nome: 'percentual_caixa',
    grupo: 'Fundamentos',
    descricao:
      'Ativos de liquidez (caixa, títulos públicos e privados, fundos de renda fixa) / ativo total',
    tipo: 'numero',
    unidade: '%',
    fonte: 'CVM, informe mensal',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.percentualCaixa,
  },
  {
    nome: 'numero_cotistas',
    grupo: 'Fundamentos',
    descricao: 'Total de cotistas',
    tipo: 'numero',
    unidade: '',
    fonte: 'CVM, informe mensal',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.numeroCotistas,
  },
  {
    nome: 'crescimento_cotistas_12m',
    grupo: 'Fundamentos',
    descricao: 'Variação do número de cotistas em 12 meses',
    tipo: 'numero',
    unidade: '%',
    fonte: 'CVM, informe mensal',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.crescimentoCotistas12m,
  },
  {
    nome: 'patrimonio_liquido',
    grupo: 'Fundamentos',
    descricao: 'Patrimônio líquido',
    tipo: 'numero',
    unidade: 'R$',
    fonte: 'CVM, informe mensal',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.patrimonioLiquido,
  },
  {
    nome: 'emissao_12m',
    grupo: 'Fundamentos',
    descricao:
      'Aumento da quantidade de cotas em 12 meses por emissões (desdobramentos descontados); diluição',
    tipo: 'numero',
    unidade: '%',
    fonte: 'CVM, informe mensal',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.emissao12m,
  },

  // Conhecimento (quão recente é o dado)
  {
    nome: 'informe_mensal',
    grupo: 'Conhecimento',
    descricao: 'Mês de referência do informe mensal usado (AAAA-MM-01)',
    tipo: 'texto',
    unidade: '',
    fonte: 'CVM',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.informeMensal,
  },
  {
    nome: 'informe_mensal_entregue',
    grupo: 'Conhecimento',
    descricao: 'Data de entrega do informe mensal usado',
    tipo: 'texto',
    unidade: '',
    fonte: 'CVM (Data_Entrega)',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.informeMensalEntregue,
  },
  {
    nome: 'dias_desde_informe',
    grupo: 'Conhecimento',
    descricao: 'Dias entre a entrega do informe mensal usado e a data',
    tipo: 'numero',
    unidade: 'dias',
    fonte: 'CVM',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.diasDesdeInforme,
  },

  // Macro
  {
    nome: 'selic_meta',
    grupo: 'Macro',
    descricao: 'Meta da Selic',
    tipo: 'numero',
    unidade: '% a.a.',
    fonte: 'BCB SGS 432',
    conhecido: MACRO,
    valor: (s) => s.selicMeta,
  },
  {
    nome: 'ipca_12m',
    grupo: 'Macro',
    descricao: 'IPCA acumulado em 12 meses (divulgado ~dia 10 do mês seguinte)',
    tipo: 'numero',
    unidade: '%',
    fonte: 'BCB SGS 13522',
    conhecido: 'IPCA do mês só a partir do dia 15 do mês seguinte',
    valor: (s) => s.ipca12m,
  },
  {
    nome: 'ntnb_juro_real',
    grupo: 'Macro',
    descricao:
      'Juro real da NTN-B (IPCA+ com juros semestrais) com vencimento mais próximo de 10 anos',
    tipo: 'numero',
    unidade: '% a.a.',
    fonte: 'Tesouro Direto (taxa de compra da manhã)',
    conhecido: MACRO,
    valor: (s) => s.ntnbJuroReal,
  },
  {
    nome: 'cdi_12m',
    grupo: 'Macro',
    descricao: 'CDI acumulado nos últimos 12 meses',
    tipo: 'numero',
    unidade: '%',
    fonte: 'BCB SGS 12',
    conhecido: MACRO,
    valor: (s) => s.cdi12m,
  },
  {
    nome: 'spread_dy_ntnb',
    grupo: 'Macro',
    descricao:
      'DY 12m menos o juro real da NTN-B (prêmio do FII sobre o título público)',
    tipo: 'numero',
    unidade: 'p.p.',
    fonte: 'derivado',
    conhecido: MACRO,
    valor: (s) => s.spreadDyNtnb,
  },

  // Relativo ao segmento
  {
    nome: 'pvp_relativo_segmento',
    grupo: 'Relativo ao segmento',
    descricao:
      'P/VP / mediana do P/VP dos fundos do mesmo segmento na data (< 1 = mais barato que os pares); mínimo de 5 fundos',
    tipo: 'numero',
    unidade: '',
    fonte: 'derivado',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.pvpRelativoSegmento,
  },
  {
    nome: 'dy_relativo_segmento',
    grupo: 'Relativo ao segmento',
    descricao: 'DY 12m menos a mediana do DY do segmento na data',
    tipo: 'numero',
    unidade: 'p.p.',
    fonte: 'derivado',
    conhecido: PROVENTOS,
    valor: (s) => s.dyRelativoSegmento,
  },
  {
    nome: 'fundos_no_segmento',
    grupo: 'Relativo ao segmento',
    descricao: 'Fundos do mesmo segmento no universo da data',
    tipo: 'numero',
    unidade: '',
    fonte: 'derivado',
    conhecido: INFORME_MENSAL,
    valor: (s) => s.fundosNoSegmento,
  },

  // Alertas
  {
    nome: 'alertas',
    grupo: 'Alertas',
    descricao:
      'Códigos dos alertas separados por vírgula (ver src/backtest/fii/alertas.ts)',
    tipo: 'texto',
    unidade: '',
    fonte: 'derivado',
    conhecido: 'mesma regra das features usadas',
    valor: (s) =>
      alertasFii(s)
        .map((alerta) => alerta.codigo)
        .join(','),
  },
  {
    nome: 'alertas_risco',
    grupo: 'Alertas',
    descricao: 'Quantidade de alertas de risco',
    tipo: 'numero',
    unidade: '',
    fonte: 'derivado',
    conhecido: 'mesma regra das features usadas',
    valor: (s) =>
      alertasFii(s).filter((alerta) => alerta.severidade === 'risco').length,
  },
]
