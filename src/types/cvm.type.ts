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

/** Dados de um FII consolidados dos informes da CVM */
export interface CvmFundo {
  /** Só dígitos */
  cnpj: string
  isin: string | null
  gestora: { nome: string; cnpj: string } | null
  /** Do mais antigo ao mais recente */
  patrimonio: CvmPatrimonio[]
  /** Do mais antigo ao mais recente */
  trimestres: CvmTrimestre[]
  /** Mês mais recente com ativo e obrigações informados */
  endividamento: CvmEndividamento | null
}
