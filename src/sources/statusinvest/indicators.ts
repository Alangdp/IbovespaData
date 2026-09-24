import type {
  FinancialIndicators,
  IndicatorRoot,
} from '../../types/indicators.type.js'
import { statusInvestApi } from './http.js'

/** Indicadores esperados; os que a API não devolver ficam zerados */
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

/**
 * Busca os indicadores históricos da ação (últimos 7 anos)
 *
 * Ao contrário das demais consultas, falha de forma explícita: o Stock não faz
 * sentido sem indicadores
 *
 * @param ticker - Código da ação (ex.: PETR4)
 * @throws Error se a API falhar
 */
export async function fetchIndicators(
  ticker: string,
): Promise<FinancialIndicators> {
  // Busca o histórico de indicadores
  const data = await statusInvestApi<IndicatorRoot>(
    'acao/indicatorhistoricallist',
    {
      method: 'POST',
      form: `codes%5B%5D=${ticker}&time=7&byQuarter=false&futureData=false`,
    },
  )
  // Se a API falhou
  if (!data) {
    throw new Error('Error Getting Indicators Data')
  }

  // Presume que todo indicador está zerado
  const indicators = {} as FinancialIndicators
  for (const key of INDICATOR_KEYS) {
    indicators[key] = { actual: 0, avg: 0, olds: [] }
  }

  // Atualiza os indicadores devolvidos pela API (a resposta vem por ticker)
  const [items] = Object.values(data.data)
  for (const item of items) {
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
