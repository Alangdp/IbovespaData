import type { CvmFundo } from '../../types/cvm.type.js'
import { parseCsv } from './csv.js'

/** CSVs usados de cada informe, pelo prefixo do nome do arquivo */
export const CVM_FILES = {
  mensal: [
    'inf_mensal_fii_geral',
    'inf_mensal_fii_complemento',
    'inf_mensal_fii_ativo_passivo',
  ],
  trimestral: ['inf_trimestral_fii_resultado_contabil_financeiro'],
  anual: ['inf_anual_fii_complemento'],
} as const

/** Conteúdo dos CSVs, pelo prefixo; um texto por ano */
export type CvmCsvs = Partial<Record<string, string[]>>

type Row = Record<string, string>

/** Remove pontuação do CNPJ */
export function cnpjDigits(cnpj: string): string {
  return cnpj.replace(/\D/g, '')
}

/** Converte o número da CVM (ponto decimal, notação científica); `null` se vazio */
function toNumber(value: string | undefined): number | null {
  // Se o campo está vazio
  if (value === undefined || value.trim() === '') {
    return null
  }
  const number = Number(value)
  return Number.isNaN(number) ? null : number
}

/**
 * Mantém só a versão mais recente de cada informe (a CVM guarda as
 * reapresentações como novas versões do mesmo `Data_Referencia`)
 */
function latestVersions(rows: Row[]): Row[] {
  const latest = new Map<string, Row>()
  for (const row of rows) {
    const key = `${row.CNPJ_Fundo_Classe}|${row.Data_Referencia}`
    const current = latest.get(key)
    // Se é a primeira versão ou uma versão mais nova
    if (!current || Number(row.Versao) > Number(current.Versao)) {
      latest.set(key, row)
    }
  }
  return [...latest.values()].sort((a, b) =>
    a.Data_Referencia.localeCompare(b.Data_Referencia),
  )
}

/**
 * Consolida os CSVs dos informes em um registro por FII
 *
 * @param csvs - Texto de cada CSV de `CVM_FILES`, um por ano
 * @returns Registros por CNPJ (só dígitos)
 */
export function buildCvmFundos(csvs: CvmCsvs): Map<string, CvmFundo> {
  const fundos = new Map<string, CvmFundo>()
  const rowsOf = (file: string) =>
    latestVersions((csvs[file] ?? []).flatMap((text) => parseCsv(text)))

  // Retorna o registro do fundo, criando na primeira vez
  const fundoOf = (row: Row): CvmFundo => {
    const cnpj = cnpjDigits(row.CNPJ_Fundo_Classe)
    let fundo = fundos.get(cnpj)
    if (!fundo) {
      fundo = {
        cnpj,
        isin: null,
        gestora: null,
        patrimonio: [],
        trimestres: [],
        endividamento: null,
      }
      fundos.set(cnpj, fundo)
    }
    return fundo
  }

  // Carrega o ISIN mais recente de cada fundo
  for (const row of rowsOf('inf_mensal_fii_geral')) {
    const isin = row.Codigo_ISIN?.trim()
    if (isin && isin.length === 12) {
      fundoOf(row).isin = isin
    }
  }

  // Carrega o patrimônio líquido e o ativo total de cada mês
  const ativos = new Map<string, number>()
  for (const row of rowsOf('inf_mensal_fii_complemento')) {
    const valor = toNumber(row.Patrimonio_Liquido)
    if (valor !== null) {
      fundoOf(row).patrimonio.push({ data: row.Data_Referencia, valor })
    }
    const ativo = toNumber(row.Valor_Ativo)
    if (ativo !== null && ativo > 0) {
      ativos.set(`${row.CNPJ_Fundo_Classe}|${row.Data_Referencia}`, ativo)
    }
  }

  // Carrega as dívidas do mês mais recente que também tem o ativo total
  for (const row of rowsOf('inf_mensal_fii_ativo_passivo')) {
    const ativo = ativos.get(`${row.CNPJ_Fundo_Classe}|${row.Data_Referencia}`)
    // Se o mês não tem ativo total informado
    if (ativo === undefined) {
      continue
    }
    fundoOf(row).endividamento = {
      data: row.Data_Referencia,
      obrigacoes:
        (toNumber(row.Obrigacoes_Securitizacao_Recebiveis) ?? 0) +
        (toNumber(row.Obrigacoes_Aquisicao_Imoveis) ?? 0),
      ativo,
    }
  }

  // Carrega a taxa de administração e o resultado de cada trimestre
  for (const row of rowsOf(
    'inf_trimestral_fii_resultado_contabil_financeiro',
  )) {
    // Presume o valor pago (financeiro); usa o contábil se ele vier zerado
    const taxa =
      Math.abs(toNumber(row.Taxa_Administracao_Financeiro) ?? 0) ||
      Math.abs(toNumber(row.Taxa_Administracao_Contabil) ?? 0)
    const isSemester = /-(06|12)-\d\d$/.test(row.Data_Referencia)

    fundoOf(row).trimestres.push({
      data: row.Data_Referencia,
      taxaAdministracao: taxa,
      resultadoSemestre: isSemester
        ? toNumber(row.Resultado_Financeiro_Liquido_Acumulado)
        : null,
      resultadoSemestre95: isSemester
        ? toNumber(row.Resultado_Financeiro_Liquido_Acumulado_95)
        : null,
      rendimentosDeclarados: isSemester
        ? toNumber(row.Rendimentos_Declarados)
        : null,
    })
  }

  // Carrega a gestora do informe anual mais recente
  for (const row of rowsOf('inf_anual_fii_complemento')) {
    const nome = row.Nome_Gestor?.trim()
    if (nome) {
      fundoOf(row).gestora = { nome, cnpj: cnpjDigits(row.CNPJ_Gestor ?? '') }
    }
  }

  return fundos
}
