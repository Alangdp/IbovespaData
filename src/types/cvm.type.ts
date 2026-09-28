/** Patrimônio líquido informado no informe mensal */
export interface CvmPatrimonio {
  /** Primeiro dia do mês de competência (AAAA-MM-DD) */
  data: string
  /** R$ */
  valor: number
}

/** Dívidas do fundo no mês, do informe mensal */
export interface CvmEndividamento {
  /** Primeiro dia do mês de competência (AAAA-MM-DD) */
  data: string
  /** Obrigações por securitização de recebíveis + por aquisição de imóveis (R$) */
  obrigacoes: number
  /** Ativo total (R$) */
  ativo: number
}

/** Dados do informe trimestral usados nos indicadores */
export interface CvmTrimestre {
  /** Último dia do trimestre (AAAA-MM-DD) */
  data: string
  /** Despesa com taxa de administração no trimestre (R$, positiva) */
  taxaAdministracao: number
  /** Resultado financeiro líquido do semestre (só em junho e dezembro) */
  resultadoSemestre: number | null
  /** 95% do resultado financeiro do semestre */
  resultadoSemestre95: number | null
  /** Rendimentos declarados no semestre */
  rendimentosDeclarados: number | null
}

/** Classe do imóvel no informe trimestral */
export type CvmClasseImovel =
  | 'renda_acabado'
  | 'renda_construcao'
  | 'venda_acabado'
  | 'venda_construcao'

/** Imóvel do informe trimestral mais recente */
export interface CvmImovel {
  nome: string
  endereco: string
  classe: CvmClasseImovel
  /** m² (0 quando não informada) */
  area: number
  /** Participação na receita do fundo (fração); `null` se não informada */
  receita: number | null
  /** Vacância (fração); `null` se não informada */
  vacancia: number | null
  /** Município identificado no endereço ("Extrema/MG"); `null` se não achou */
  cidade: string | null
  /** Código IBGE do município */
  municipioId: number | null
  uf: string | null
  /** Classificação da cidade (ver `CvmRegiao`); `null` sem cidade */
  boaLocalizacao: boolean | null
}

/** Resumo de uma classe de ativo da carteira (CRIs/CRAs ou FIIs) */
export interface CvmCarteiraClasse {
  quantidade: number
  /** R$ */
  total: number
  /** Maior posição (R$) */
  maior: number
}

/** Carteira de títulos do informe trimestral mais recente */
export interface CvmCarteira {
  /** Último dia do trimestre (AAAA-MM-DD) */
  data: string
  /** Patrimônio líquido do mês do trimestre (R$); `null` se não informado */
  patrimonio: number | null
  cri: CvmCarteiraClasse
  fii: CvmCarteiraClasse
}

/** Quanto do ativo está em cada classe, no informe mensal mais recente */
export interface CvmComposicao {
  /** Primeiro dia do mês de competência (AAAA-MM-DD) */
  data: string
  /** Imóveis, terrenos e participações em sociedades imobiliárias (R$) */
  imoveis: number
  /** CRIs e CRAs (R$) */
  cri: number
  /** Cotas de FII (R$) */
  fii: number
}

/** Dados de um FII consolidados dos informes da CVM */
export interface CvmFundo {
  /** Só dígitos */
  cnpj: string
  isin: string | null
  gestora: { nome: string; cnpj: string } | null
  /** Segmento de atuação declarado no informe mensal (ex.: Logística) */
  segmentoAtuacao: string | null
  /** Do mais antigo ao mais recente */
  patrimonio: CvmPatrimonio[]
  /** Do mais antigo ao mais recente */
  trimestres: CvmTrimestre[]
  /** Mês mais recente com ativo e obrigações informados */
  endividamento: CvmEndividamento | null
  /** Imóveis do informe trimestral mais recente */
  imoveis: CvmImovel[]
  /** Data do informe trimestral de onde vieram os imóveis */
  imoveisData: string | null
  carteira: CvmCarteira | null
  composicao: CvmComposicao | null
}

/** Fonte da classificação de uma cidade */
export type CvmRegiaoFonte = 'vacancia_tipo' | 'vacancia_cidade' | 'ibge'

/**
 * Classificação de uma cidade para um tipo de imóvel
 *
 * Boa = vacância média dos imóveis de FII na cidade abaixo da média do
 * mercado no mesmo tipo; sem imóveis suficientes, compara a cidade com todos
 * os tipos; sem isso, usa o IBGE (região metropolitana de capital ou
 * população mínima)
 */
export interface CvmRegiao {
  /** Tipo de imóvel (segmento de atuação do fundo) */
  tipo: string
  cidade: string
  uf: string
  municipioId: number
  /** Imóveis de renda acabados na cidade (todos os FIIs) */
  imoveis: number
  fundos: number
  /** Vacância média na cidade (%); `null` sem imóveis suficientes */
  vacanciaMedia: number | null
  /** Vacância média do mercado usada na comparação (%) */
  vacanciaMercado: number | null
  boa: boolean
  fonte: CvmRegiaoFonte
}

/** Gestora de FII, do informe anual */
export interface CvmGestora {
  /** Só dígitos */
  cnpj: string
  nome: string
  /** Quantidade de FIIs geridos */
  fundos: number
}
