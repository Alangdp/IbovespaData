import type {
  FinancialIndicators,
  IndicatorRoot,
} from '../../types/indicators.type.js'
import { statusInvestApi } from './http.js'

// Todo indicador começa zerado; os que a API devolver sobrescrevem o padrão.
const INDICATOR_KEYS: (keyof FinancialIndicators)[] = [
  'dy',
  'p_l',
  'p_vp',
  'p_ebita',
  'p_ebit',
  'p_sr',
  'p_ativo',
  'p_capitlgiro',
  'p_ativocirculante',
  'ev_ebitda',
  'ev_ebit',
  'lpa',
  'vpa',
  'peg_Ratio',
  'dividaliquida_patrimonioliquido',
  'dividaliquida_ebitda',
  'dividaliquida_ebit',
  'patrimonio_ativo',
  'passivo_ativo',
  'liquidezcorrente',
  'margembruta',
  'margemebitda',
  'margemebit',
  'margemliquida',
  'roe',
  'roa',
  'roic',
  'giro_ativos',
  'receitas_cagr5',
]

function emptyIndicators(): FinancialIndicators {
  return Object.fromEntries(
    INDICATOR_KEYS.map((key) => [key, { actual: 0, avg: 0, olds: [] }]),
  ) as unknown as FinancialIndicators
}

// Indicadores históricos (últimos 7 anos). Ao contrário das demais consultas,
// falha de forma explícita: o Stock não faz sentido sem indicadores.
export async function fetchIndicators(
  ticker: string,
): Promise<FinancialIndicators> {
  const data = await statusInvestApi<IndicatorRoot>(
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      params: `codes%5B%5D=${ticker}&time=7&byQuarter=false&futureData=false`,
    },
    'indicatorhistoricallist',
  )
  if (!data) throw new Error('Error Getting Indicators Data')

  const indicators = emptyIndicators()

  const tickerReference = Object.keys(data.data)[0]
  for (const item of data.data[tickerReference]) {
    indicators[item.key as keyof FinancialIndicators] = {
      actual: item.actual,
      avg: item.avg,
      olds: item.ranks.map((rank) => ({
        date: rank.rank,
        value: rank.value ?? 0,
      })),
    }
  }

  return indicators
}
