import type { ltvQueueData } from '@/global/Queue'
import type { LtvRelatorio } from '@/useCases/FundoFetcher'

/** Dependências do processador, injetadas para permitir testes sem Redis */
interface Dependencies {
  loadLtv: (cnpj: string) => Promise<LtvRelatorio>
  invalidateFundo: (ticker: string) => Promise<void>
}

/**
 * Cria o processador dos jobs da fila: lê o LTV e o spread do relatório
 * gerencial do fundo e invalida o cache do detalhe, para a próxima
 * requisição já trazer os dois. A montagem real está em LtvQueue.ts
 */
export function createLtvRefresher({ loadLtv, invalidateFundo }: Dependencies) {
  return async (job: { data: ltvQueueData }) => {
    const { cnpj, ticker } = job.data

    // Lê o LTV e o spread do relatório gerencial
    const ltv = await loadLtv(cnpj)
    // Se encontrou o LTV ou o spread, invalida o detalhe do fundo em cache
    // (sem nenhum dos dois o detalhe em cache já está correto e não precisa
    // ser raspado de novo)
    if (ltv.ltv !== null || ltv.spread !== null) {
      await invalidateFundo(ticker)
    }
    return ltv
  }
}
