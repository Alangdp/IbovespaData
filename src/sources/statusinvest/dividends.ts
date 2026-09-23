import type {
  DividendReturn,
  RootDividend,
} from '../../types/dividends.type.js'
import Utilities from '../../utils/Utilities.js'
import { statusInvestApi } from './http.js'

// Dividendos pagos (por pagamento e por ano). Devolve null se a API falhar.
export async function fetchDividends(
  ticker: string,
): Promise<DividendReturn | null> {
  try {
    const data = await statusInvestApi<RootDividend>(
      { method: 'GET', headers: {} },
      `companytickerprovents?ticker=${ticker}&chartProventsType=2`,
    )
    if (!data) throw new Error('Error Getting Dividends Data')

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
  } catch (error) {
    return null
  }
}
