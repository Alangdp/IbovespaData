import type {
  FrequenciaAporte,
  FrequenciaRebalanceamento,
  IsoDate,
} from './types.js'

const DAY_MS = 24 * 60 * 60 * 1000

/** Converte a data ISO em milissegundos (meia-noite UTC) */
function toMs(date: IsoDate): number {
  return Date.parse(`${date}T00:00:00Z`)
}

/** Converte milissegundos em data ISO (UTC) */
function fromMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Soma dias corridos à data */
export function addDays(date: IsoDate, days: number): IsoDate {
  return fromMs(toMs(date) + days * DAY_MS)
}

/** Soma meses à data, parando no último dia do mês quando ele não existe */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return fromMs(target.getTime())
}

/** Dias corridos de `from` até `to` */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS)
}

/** Dia da semana (0 = domingo ... 6 = sábado) */
export function weekday(date: IsoDate): number {
  return new Date(toMs(date)).getUTCDay()
}

/** Converte "dd/mm/aaaa" em data ISO; `null` se o texto não for uma data */
export function brToIso(text: string | undefined): IsoDate | null {
  const match = text?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

/** Último dia do mês da data */
export function endOfMonth(date: IsoDate): IsoDate {
  return addDays(addMonths(`${date.slice(0, 7)}-01`, 1), -1)
}

/**
 * Busca, em uma lista ordenada, o índice do último elemento `<= date`
 *
 * @returns -1 se todos forem maiores
 */
export function lastIndexAtOrBefore(sorted: IsoDate[], date: IsoDate): number {
  let low = 0
  let high = sorted.length - 1
  let found = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (sorted[middle] <= date) {
      found = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return found
}

/**
 * Calcula as datas de aporte entre os pregões
 *
 * - diária: todo pregão
 * - semanal: o primeiro pregão da semana a partir do dia da semana pedido
 * - mensal: o primeiro pregão a partir do dia do mês pedido; se o mês acabar
 *   antes, o último pregão do mês
 *
 * @param pregoes - Pregões do período, em ordem
 * @param dia - Dia da semana (1 a 5) ou do mês (1 a 31); padrão 1
 */
export function datasAporte(
  pregoes: IsoDate[],
  frequencia: FrequenciaAporte,
  dia = 1,
): IsoDate[] {
  // Se o aporte é diário
  if (frequencia === 'diaria') {
    return [...pregoes]
  }

  // Agrupa os pregões por semana (segunda-feira da semana) ou por mês
  const grupos = new Map<string, IsoDate[]>()
  for (const pregao of pregoes) {
    const chave =
      frequencia === 'semanal'
        ? addDays(pregao, -((weekday(pregao) + 6) % 7))
        : pregao.slice(0, 7)
    const grupo = grupos.get(chave) ?? []
    grupo.push(pregao)
    grupos.set(chave, grupo)
  }

  // Escolhe, em cada grupo, o primeiro pregão a partir do dia pedido
  const datas: IsoDate[] = []
  for (const [chave, grupo] of grupos) {
    const alvo =
      frequencia === 'semanal'
        ? addDays(chave, Math.min(Math.max(dia, 1), 5) - 1)
        : `${chave}-${String(Math.min(Math.max(dia, 1), 31)).padStart(2, '0')}`
    const data = grupo.find((pregao) => pregao >= alvo)
    // Se o grupo acabou antes do dia pedido
    if (!data) {
      // Presume que no mensal vale o último pregão do mês; na semana
      // incompleta (fim do período) não há aporte
      if (frequencia === 'mensal') {
        datas.push(grupo[grupo.length - 1])
      }
      continue
    }
    datas.push(data)
  }
  return datas
}

/** Meses entre rebalanceamentos */
const MESES_REBALANCEAMENTO: Record<FrequenciaRebalanceamento, number> = {
  nenhum: 0,
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
}

/**
 * Escolhe, entre as datas de aporte, as que também rebalanceiam: a primeira
 * data de aporte de cada período, sem contar o primeiro aporte
 */
export function datasRebalanceamento(
  aportes: IsoDate[],
  frequencia: FrequenciaRebalanceamento,
): Set<IsoDate> {
  const meses = MESES_REBALANCEAMENTO[frequencia]
  const datas = new Set<IsoDate>()
  // Se não há rebalanceamento ou nenhum aporte
  if (meses === 0 || aportes.length === 0) {
    return datas
  }

  // Marca a primeira data de aporte a partir de cada fronteira de período
  let proxima = addMonths(`${aportes[0].slice(0, 7)}-01`, meses)
  for (const data of aportes) {
    if (data >= proxima) {
      datas.add(data)
      while (proxima <= data) {
        proxima = addMonths(proxima, meses)
      }
    }
  }
  return datas
}
