import { addDays, lastIndexAtOrBefore } from './dates.js'
import type {
  AtivoSnapshot,
  HistoricalDataProvider,
} from './HistoricalDataProvider.js'
import type { IsoDate } from './types.js'

type Provider = HistoricalDataProvider<AtivoSnapshot>

/**
 * O que aconteceu com o ativo num horizonte depois da data (o "rótulo" de
 * uma linha do dataset)
 *
 * Tudo na base de cotas da data inicial: o preço final é multiplicado pelos
 * desdobramentos do período e cada provento pelo fator até a sua data-com
 */
export interface RotuloHorizonte {
  horizonte: number
  /** Último pregão considerado (o último até data + horizonte) */
  dataFinal: IsoDate
  /** Retorno total (preço + proventos, sem reinvestir) */
  retornoTotal: number
  retornoPreco: number
  retornoDividendos: number
  /**
   * Pior queda do valor (preço + proventos acumulados) em relação ao maior
   * valor anterior dentro do horizonte, a partir do preço de compra (<= 0)
   */
  drawdown: number
  /** `false` se o ativo parou de negociar antes do fim do horizonte */
  completo: boolean
}

/**
 * Calcula os rótulos de todos os horizontes de uma vez, percorrendo a
 * trajetória do ativo uma só vez a partir da data
 *
 * A compra é no fechamento da data (`precoBase`), então o provento com
 * data-com na própria data conta. Horizontes que passam da última data da
 * base ficam de fora (ainda não aconteceram)
 *
 * @param ultimaData - Última data com cotação na base
 */
export function rotulosFuturos(
  provider: Provider,
  ativoId: string,
  data: IsoDate,
  precoBase: number,
  horizontes: number[],
  ultimaData: IsoDate,
): RotuloHorizonte[] {
  // Se não há preço de compra
  if (precoBase <= 0) {
    return []
  }
  const fins = horizontes
    .map((horizonte) => ({ horizonte, fim: addDays(data, horizonte) }))
    .filter((item) => item.fim <= ultimaData)
    .sort((a, b) => a.fim.localeCompare(b.fim))
  // Se nenhum horizonte terminou na base
  if (fins.length === 0) {
    return []
  }

  const datas = provider.datasPrecos(ativoId)
  const precos = provider.precos(ativoId)
  const eventos = provider.eventos(ativoId).filter((e) => e.data > data)
  const proventos = provider.proventos(ativoId).filter((p) => p.dataCom >= data)
  const ultimaNegociacao = provider.ativo(ativoId)?.ultimaData ?? ultimaData

  // Percorre os pregões depois da data, aplicando os desdobramentos e
  // somando os proventos na ordem em que acontecem
  let fator = 1
  let dividendos = 0
  let iEvento = 0
  let iProvento = 0
  let precoAtual = precoBase
  let dataAtual = data
  let maior = precoBase
  let drawdown = 0
  let iFim = 0
  const rotulos: RotuloHorizonte[] = []

  /** Aplica eventos e proventos até a data (eventos antes, no mesmo dia) */
  const avancarAte = (ate: IsoDate) => {
    while (true) {
      const evento = eventos[iEvento]
      const provento = proventos[iProvento]
      const proximoEvento = evento && evento.data <= ate ? evento.data : null
      const proximoProvento =
        provento && provento.dataCom <= ate ? provento.dataCom : null
      // Se não há mais nada até a data
      if (!proximoEvento && !proximoProvento) {
        return
      }
      if (
        proximoEvento &&
        (!proximoProvento || proximoEvento <= proximoProvento)
      ) {
        fator *= evento.fator ?? 1
        iEvento++
      } else {
        dividendos += provento.valor * fator
        iProvento++
      }
    }
  }

  /** Registra os horizontes que terminam antes de `limite` */
  const fecharHorizontes = (limite: IsoDate | null) => {
    while (iFim < fins.length && (limite === null || fins[iFim].fim < limite)) {
      const { horizonte, fim } = fins[iFim]
      avancarAte(fim)
      const valor = precoAtual * fator + dividendos
      rotulos.push({
        horizonte,
        dataFinal: dataAtual,
        retornoTotal: valor / precoBase - 1,
        retornoPreco: (precoAtual * fator) / precoBase - 1,
        retornoDividendos: dividendos / precoBase,
        drawdown: Math.min(drawdown, valor / maior - 1),
        completo: ultimaNegociacao >= fim,
      })
      iFim++
    }
  }

  // Proventos com data-com na própria data entram antes do primeiro pregão
  avancarAte(data)
  for (
    let i = lastIndexAtOrBefore(datas, data) + 1;
    i < precos.length && iFim < fins.length;
    i++
  ) {
    const pregao = precos[i]
    // Fecha os horizontes que terminam antes deste pregão
    fecharHorizontes(pregao.data)
    if (iFim >= fins.length) {
      break
    }

    // Atualiza a trajetória com o pregão
    avancarAte(pregao.data)
    precoAtual = pregao.fechamento
    dataAtual = pregao.data
    const valor = precoAtual * fator + dividendos
    maior = Math.max(maior, valor)
    drawdown = Math.min(drawdown, valor / maior - 1)
  }
  // Fecha os horizontes restantes (o ativo parou de negociar antes)
  fecharHorizontes(null)

  return rotulos.sort((a, b) => a.horizonte - b.horizonte)
}
