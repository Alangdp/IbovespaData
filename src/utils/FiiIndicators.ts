import type { CvmFundo } from '../types/cvm.type.js'
import type { FiiDividend } from '../types/fii.type.js'
import { DateFormatter } from './DateFormater.js'
import MathUtils from './MathUtils.js'

/** Quantos trimestres entram na taxa de administração anual */
const QUARTERS = 4

/** Mínimo exigido por lei: 95% do resultado financeiro do semestre */
const MIN_DISTRIBUTION = 0.95

/** Rendimento acima de 1,5x a mediana do ano é extraordinário */
const EXTRAORDINARY_FACTOR = 1.5

/** Mínimo de pagamentos no ano para a mediana fazer sentido */
const MIN_PAYMENTS = 3

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

/** Taxa de administração de um trimestre */
export interface TaxaTrimestre {
  /** Último dia do trimestre (AAAA-MM-DD) */
  trimestre: string
  /** Despesa com taxa de administração no trimestre (R$) */
  taxa_paga: number
  /** Média do patrimônio líquido nos meses do trimestre (R$) */
  patrimonio_medio: number
  /** Taxa do trimestre anualizada (% ao ano) */
  percentual_anualizado: number
}

/** Resultado do limite de distribuição do último semestre */
export interface LimiteDistribuicao {
  respeitado: boolean | null
  /** Rendimentos declarados / resultado financeiro do semestre (%) */
  percentual_distribuido: number | null
}

/** Indicadores de FII calculados a partir dos informes da CVM e proventos */
export default class FiiIndicators {
  /**
   * Calcula a taxa de administração de cada um dos últimos 4 trimestres
   *
   * Usa a despesa total do informe trimestral (administração + gestão), e não
   * o percentual do informe mensal, que cobre só a parte do administrador
   */
  static taxaPorTrimestre(fundo: CvmFundo): TaxaTrimestre[] {
    return fundo.trimestres
      .filter((trimestre) => trimestre.taxaAdministracao > 0)
      .slice(-QUARTERS)
      .map((trimestre): TaxaTrimestre | null => {
        // Calcula o patrimônio médio dos meses do trimestre
        const end = trimestre.data.slice(0, 7)
        const start = shiftMonth(end, -2)
        const values = fundo.patrimonio
          .filter((pl) => {
            const month = pl.data.slice(0, 7)
            return month >= start && month <= end
          })
          .map((pl) => pl.valor)
        const patrimonio = MathUtils.makeAverage(values)
        // Se não há patrimônio positivo informado no trimestre
        if (values.length === 0 || patrimonio <= 0) {
          return null
        }

        return {
          trimestre: trimestre.data,
          taxa_paga: trimestre.taxaAdministracao,
          patrimonio_medio: round(patrimonio, 2),
          percentual_anualizado: round(
            (trimestre.taxaAdministracao / patrimonio) * QUARTERS * 100,
            4,
          ),
        }
      })
      .filter((taxa): taxa is TaxaTrimestre => taxa !== null)
  }

  /**
   * Calcula a taxa de administração anual (% ao ano), média dos últimos
   * trimestres anualizados
   *
   * @returns `null` se não houver trimestre com taxa e patrimônio
   */
  static taxaAdministracao(fundo: CvmFundo | null): number | null {
    // Se o fundo não tem informes na CVM
    if (!fundo) {
      return null
    }
    const trimestres = FiiIndicators.taxaPorTrimestre(fundo)
    // Se nenhum trimestre tem taxa e patrimônio
    if (trimestres.length === 0) {
      return null
    }
    return round(
      MathUtils.makeAverage(trimestres.map((t) => t.percentual_anualizado)),
      4,
    )
  }

  /**
   * Calcula a alavancagem: dívidas por securitização de recebíveis e por
   * aquisição de imóveis sobre o ativo total (%), no mês mais recente
   *
   * @returns `null` se o fundo não tiver informe mensal com ativo
   */
  static alavancagem(fundo: CvmFundo | null): number | null {
    const endividamento = fundo?.endividamento
    // Se não há mês com ativo informado
    if (!endividamento) {
      return null
    }
    return round((endividamento.obrigacoes / endividamento.ativo) * 100, 4)
  }

  /**
   * Verifica se o fundo distribuiu ao menos 95% do resultado financeiro do
   * último semestre informado
   *
   * Sem resultado positivo não há mínimo a cumprir: conta como respeitado
   */
  static limiteDistribuicao(fundo: CvmFundo | null): LimiteDistribuicao {
    // Busca o último semestre com resultado informado
    const semestre = fundo?.trimestres
      .filter((trimestre) => trimestre.resultadoSemestre !== null)
      .at(-1)
    // Se não há semestre informado
    if (!semestre || semestre.resultadoSemestre === null) {
      return { respeitado: null, percentual_distribuido: null }
    }

    const resultado = semestre.resultadoSemestre
    const declarados = semestre.rendimentosDeclarados ?? 0
    // Se o semestre não teve resultado positivo
    if (resultado <= 0) {
      return { respeitado: true, percentual_distribuido: null }
    }

    const minimo = semestre.resultadoSemestre95 ?? resultado * MIN_DISTRIBUTION
    return {
      respeitado: declarados >= minimo,
      percentual_distribuido: round((declarados / resultado) * 100, 2),
    }
  }

  /**
   * Verifica se algum rendimento dos últimos 12 meses passou de 1,5x a
   * mediana dos rendimentos do período
   *
   * @returns `null` com menos de 3 rendimentos no período
   */
  static dividendoExtraordinario(dividends: FiiDividend[]): boolean | null {
    // Carrega os rendimentos pagos nos últimos 12 meses
    const since = Date.now() - YEAR_MS
    const values = dividends
      .filter((dividend) => dividend.tipo === 'Rendimento')
      .filter((dividend) => {
        const date = DateFormatter.stringToDate(dividend.dataPagamento)
        return date !== null && date.getTime() >= since
      })
      .map((dividend) => dividend.valor)
    // Se há poucos pagamentos para comparar
    if (values.length < MIN_PAYMENTS) {
      return null
    }

    const median = MathUtils.makeMedian(values)
    return values.some((value) => value > median * EXTRAORDINARY_FACTOR)
  }
}

/**
 * "LTV médio" ou "LTV consolidado", seguido do valor em até 40 caracteres sem
 * números (ex.: "LTV médio 56%", "LTV médio ponderado da carteira: 57,20%")
 */
const LTV_PATTERN =
  /LTV\s+(?:m[ée]dio|consolidado)([^0-9%]{0,40}?)(\d{1,3}(?:[.,]\d{1,2})?)\s*%/gi

/** Trechos que indicam limite ou faixa, e não o LTV da carteira */
const LTV_LIMIT_WORDS =
  /inferior|superior|m[áa]xim|m[íi]nim|\bat[ée]\b|abaixo|acima|limite|entre/i

/**
 * Extrai o LTV médio da carteira de CRIs do texto do relatório gerencial
 *
 * Usa a primeira ocorrência de "LTV médio"/"LTV consolidado" que não seja um
 * limite ("LTV médio inferior a 40%"). O LTV de cada CRI ("LTV de 71%") não
 * conta
 *
 * @returns % entre 0 e 100, ou `null` se o relatório não informar
 */
export function extractLtvMedio(text: string): number | null {
  for (const match of text.matchAll(LTV_PATTERN)) {
    const [, between, value] = match
    // Se o trecho é um limite ou faixa
    if (LTV_LIMIT_WORDS.test(between)) {
      continue
    }
    const ltv = Number(value.replace(',', '.'))
    // Se o valor está fora da faixa possível
    if (ltv <= 0 || ltv > 100) {
      continue
    }
    return ltv
  }
  return null
}

/** Soma meses a um `AAAA-MM` */
function shiftMonth(yearMonth: string, months: number): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const date = new Date(year, month - 1 + months, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
