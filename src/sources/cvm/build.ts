import type {
  CvmCarteiraClasse,
  CvmClasseImovel,
  CvmFundo,
  CvmImovel,
} from '../../types/cvm.type.js'
import type { Municipio } from '../ibge.js'
import { parseCsv } from './csv.js'

/** CSVs usados de cada informe, pelo prefixo do nome do arquivo */
export const CVM_FILES = {
  mensal: [
    'inf_mensal_fii_geral',
    'inf_mensal_fii_complemento',
    'inf_mensal_fii_ativo_passivo',
  ],
  trimestral: [
    'inf_trimestral_fii_resultado_contabil_financeiro',
    'inf_trimestral_fii_imovel',
    'inf_trimestral_fii_ativo',
  ],
  anual: ['inf_anual_fii_complemento'],
} as const

/** Identifica o município de um endereço (ver `CidadeResolver`) */
export type ResolveCidade = (endereco: string) => Municipio | null

/** Classe do imóvel pelo texto da CVM ("Imóveis para renda acabados") */
const CLASSES_IMOVEL: Record<string, CvmClasseImovel> = {
  'Imóveis para renda acabados': 'renda_acabado',
  'Imóveis para renda em construção': 'renda_construcao',
  'Imóveis para venda acabados': 'venda_acabado',
  'Imóveis para venda em construção': 'venda_construcao',
}

/** Conteúdo dos CSVs, pelo prefixo; um texto por ano */
export type CvmCsvs = Partial<Record<string, string[]>>

/** Linha de um CSV da CVM, indexada pelo nome da coluna */
export type CvmRow = Record<string, string>

/** Linhas dos CSVs já lidas, pelo prefixo do arquivo */
export type CvmRows = Partial<Record<string, CvmRow[]>>

type Row = CvmRow

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
 * Agrupa as linhas de um CSV com várias linhas por informe (imóveis, ativos)
 * e mantém, de cada fundo, só o informe mais recente na versão mais recente
 *
 * @returns Linhas por CNPJ (com pontuação, como no CSV)
 */
function latestReportRows(rows: Row[]): Map<string, Row[]> {
  // Encontra a data e a versão mais recentes de cada fundo
  const latest = new Map<string, { data: string; versao: number }>()
  for (const row of rows) {
    const current = latest.get(row.CNPJ_Fundo_Classe)
    const versao = Number(row.Versao)
    if (
      !current ||
      row.Data_Referencia > current.data ||
      (row.Data_Referencia === current.data && versao > current.versao)
    ) {
      latest.set(row.CNPJ_Fundo_Classe, { data: row.Data_Referencia, versao })
    }
  }

  // Separa as linhas desse informe
  const grouped = new Map<string, Row[]>()
  for (const row of rows) {
    const report = latest.get(row.CNPJ_Fundo_Classe)
    // Se a linha não é do informe mais recente
    if (
      report?.data !== row.Data_Referencia ||
      report.versao !== Number(row.Versao)
    ) {
      continue
    }
    const list = grouped.get(row.CNPJ_Fundo_Classe) ?? []
    list.push(row)
    grouped.set(row.CNPJ_Fundo_Classe, list)
  }
  return grouped
}

/**
 * Converte um percentual da CVM para fração: a maioria informa fração
 * (0,05), mas alguns informam percentual (5)
 */
function toFraction(value: string | undefined): number | null {
  const number = toNumber(value)
  // Se o campo está vazio ou é negativo
  if (number === null || number < 0) {
    return null
  }
  return number > 1 ? number / 100 : number
}

/** Monta o imóvel do informe trimestral, com o município do endereço */
function toImovel(row: Row, resolveCidade?: ResolveCidade): CvmImovel | null {
  const classe = CLASSES_IMOVEL[row.Classe?.trim()]
  // Se a classe não é de imóvel pronto ou em construção
  if (!classe) {
    return null
  }
  const endereco = row.Endereco?.trim() ?? ''
  const municipio = resolveCidade && endereco ? resolveCidade(endereco) : null
  return {
    nome: row.Nome_Imovel?.trim() ?? '',
    endereco,
    classe,
    area: Math.max(toNumber(row.Area) ?? 0, 0),
    receita: toFraction(row.Percentual_Receitas_FII),
    vacancia: toFraction(row.Percentual_Vacancia),
    cidade: municipio ? `${municipio.nome}/${municipio.uf}` : null,
    municipioId: municipio?.id ?? null,
    uf: municipio?.uf ?? null,
    boaLocalizacao: null,
  }
}

/** Resume as posições de uma classe de ativo */
function toCarteiraClasse(valores: number[]): CvmCarteiraClasse {
  return {
    quantidade: valores.length,
    total: valores.reduce((sum, valor) => sum + valor, 0),
    maior: valores.length > 0 ? Math.max(...valores) : 0,
  }
}

/**
 * Consolida os CSVs dos informes em um registro por FII
 *
 * @param csvs - Texto de cada CSV de `CVM_FILES`, um por ano
 * @param resolveCidade - Identifica o município do endereço de cada imóvel;
 * sem ele os imóveis ficam sem cidade
 * @returns Registros por CNPJ (só dígitos)
 */
export function buildCvmFundos(
  csvs: CvmCsvs,
  resolveCidade?: ResolveCidade,
): Map<string, CvmFundo> {
  // Lê os CSVs de cada arquivo, juntando os anos
  const rows: CvmRows = Object.fromEntries(
    Object.entries(csvs).map(([file, texts]) => [
      file,
      (texts ?? []).flatMap((text) => parseCsv(text)),
    ]),
  )
  return buildCvmFundosFromRows(rows, resolveCidade)
}

/**
 * Consolida as linhas já lidas dos informes em um registro por FII
 *
 * Usa sempre o informe mais recente (e a versão mais recente) entre as linhas
 * recebidas: filtrando as linhas pela data de entrega, o resultado é o fundo
 * como era conhecido naquela data (usado no backtest)
 *
 * @param rows - Linhas de cada CSV de `CVM_FILES`
 * @param resolveCidade - Identifica o município do endereço de cada imóvel
 * @returns Registros por CNPJ (só dígitos)
 */
export function buildCvmFundosFromRows(
  rows: CvmRows,
  resolveCidade?: ResolveCidade,
): Map<string, CvmFundo> {
  const fundos = new Map<string, CvmFundo>()
  const allRowsOf = (file: string) => rows[file] ?? []
  const rowsOf = (file: string) => latestVersions(allRowsOf(file))

  // Retorna o registro do fundo, criando na primeira vez
  const fundoOf = (row: Row): CvmFundo => {
    const cnpj = cnpjDigits(row.CNPJ_Fundo_Classe)
    let fundo = fundos.get(cnpj)
    if (!fundo) {
      fundo = {
        cnpj,
        isin: null,
        gestora: null,
        segmentoAtuacao: null,
        patrimonio: [],
        trimestres: [],
        endividamento: null,
        imoveis: [],
        imoveisData: null,
        carteira: null,
        composicao: null,
      }
      fundos.set(cnpj, fundo)
    }
    return fundo
  }

  // Carrega o ISIN e o segmento de atuação mais recentes de cada fundo
  for (const row of rowsOf('inf_mensal_fii_geral')) {
    const isin = row.Codigo_ISIN?.trim()
    if (isin && isin.length === 12) {
      fundoOf(row).isin = isin
    }
    const segmento = row.Segmento_Atuacao?.trim()
    if (segmento) {
      fundoOf(row).segmentoAtuacao = segmento
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

  // Carrega as dívidas do mês mais recente que também tem o ativo total, e
  // a composição do ativo do mês mais recente
  for (const row of rowsOf('inf_mensal_fii_ativo_passivo')) {
    fundoOf(row).composicao = {
      data: row.Data_Referencia,
      imoveis:
        (toNumber(row.Direitos_Bens_Imoveis) ?? 0) +
        (toNumber(row.Acoes_Sociedades_Atividades_FII) ?? 0) +
        (toNumber(row.Cotas_Sociedades_Atividades_FII) ?? 0),
      cri: (toNumber(row.CRI) ?? 0) + (toNumber(row.CRI_CRA) ?? 0),
      fii: toNumber(row.FII) ?? 0,
    }

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

  // Carrega os imóveis do informe trimestral mais recente
  for (const [, rows] of latestReportRows(
    allRowsOf('inf_trimestral_fii_imovel'),
  )) {
    const fundo = fundoOf(rows[0])
    fundo.imoveisData = rows[0].Data_Referencia
    fundo.imoveis = rows
      .map((row) => toImovel(row, resolveCidade))
      .filter((imovel): imovel is CvmImovel => imovel !== null)
  }

  // Carrega a carteira de CRIs/CRAs e FIIs do informe trimestral mais
  // recente, com o patrimônio do mesmo mês
  for (const [, rows] of latestReportRows(
    allRowsOf('inf_trimestral_fii_ativo'),
  )) {
    const fundo = fundoOf(rows[0])
    const data = rows[0].Data_Referencia
    const valoresDo = (tipo: string) =>
      rows
        .filter((row) => row.Tipo?.trim() === tipo)
        .map((row) => toNumber(row.Valor) ?? 0)
        .filter((valor) => valor > 0)
    const patrimonio = fundo.patrimonio.find(
      (pl) => pl.data.slice(0, 7) === data.slice(0, 7),
    )
    fundo.carteira = {
      data,
      patrimonio: patrimonio?.valor ?? null,
      cri: toCarteiraClasse(valoresDo('CRI/CRA')),
      fii: toCarteiraClasse(valoresDo('FII')),
    }
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
