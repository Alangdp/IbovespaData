import type {
  DividendReturn,
  RootDividend,
} from '../../types/dividends.type.js'
import Utilities from '../../utils/Utilities.js'
import { statusInvestApi } from './http.js'

/**
 * Busca os dividendos pagos, por pagamento e por ano
 *
 * @param ticker - Código da ação (ex.: PETR4)
 * @returns Os dividendos convertidos, ou `null` se a API falhar
 */
export async function fetchDividends(
  ticker: string,
): Promise<DividendReturn | null> {
  // Busca os proventos da ação
  const data = await statusInvestApi<RootDividend>(
    `acao/companytickerprovents?ticker=${ticker}&chartProventsType=2`,
  )
  // Se a API falhou
  if (!data) {
    return null
  }

  try {
    // Retorna os proventos com os nomes de campo da aplicação
    return {
      lastDividendPayments: data.assetEarningsModels.map((payment) => ({
        ticker,
        dataCom: payment.ed,
        dataEx: payment.pd,
        dividendType: payment.et,
        dividendTypeName: payment.etd,
        value: payment.v,
      })),
      lastDividendPaymentsYear: data.assetEarningsYearlyModels.map((year) => ({
        year: year.rank,
        value: year.value,
      })),
      helper: {
        earningsThisYearHelper: data.helpers.earningsThisYearHelper,
        earningsLastYearHelper: data.helpers.earningsLastYearHelper,
        earningsProvisionedHelper: data.helpers.earningsProvisionedHelper,
        earningsMainTextHelper: data.helpers.earningsMainTextHelper,
      },
      dividendPaymentThisYear: Utilities.formateNumber(data.earningsThisYear),
      dividendPaymentLastYear: Utilities.formateNumber(data.earningsLastYear),
    }
  } catch {
    return null
  }
}
