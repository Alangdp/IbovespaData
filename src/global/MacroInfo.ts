import axios from 'axios'

/** Item da API de séries temporais (SGS) do Banco Central */
interface SgsValue {
  data: string
  valor: string
}

/** Tempo que um indicador fica guardado em memória antes de ser buscado de novo (ms) */
const CACHE_MS = 6 * 60 * 60 * 1000

/**
 * Busca o valor mais recente de uma série do SGS do Banco Central
 *
 * @param serie - Código da série (ex.: 4389 para o CDI anualizado)
 * @returns O valor convertido de percentual para decimal (13.65 vira 0.1365)
 */
async function fetchLatestRate(serie: number): Promise<number> {
  const { data } = await axios.get<SgsValue[]>(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`,
    { timeout: 15000 },
  )
  return Number(data[0].valor) / 100
}

/** Indicadores macroeconômicos (taxas anuais, em decimal) */
export class MacroInfo {
  private static readonly cache = new Map<
    number,
    { value: number; expiresAt: number }
  >()

  /**
   * Retorna a taxa da série, guardada em memória por 6 horas
   *
   * @returns `null` se o Banco Central não responder
   */
  private static async getRate(serie: number): Promise<number | null> {
    // Se a taxa está em memória e dentro da validade
    const cached = MacroInfo.cache.get(serie)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }

    try {
      // Busca a taxa e guarda em memória
      const value = await fetchLatestRate(serie)
      MacroInfo.cache.set(serie, { value, expiresAt: Date.now() + CACHE_MS })
      return value
    } catch (error) {
      console.error(`Erro ao buscar a série ${serie} do BCB:`, error)
      return null
    }
  }

  /** Taxa Selic anualizada (série 1178) */
  static getSELIC() {
    return MacroInfo.getRate(1178)
  }

  /** Taxa CDI anualizada (série 4389) */
  static getCDI() {
    return MacroInfo.getRate(4389)
  }

  /** IPCA acumulado em 12 meses (série 13522) */
  static getIPCA() {
    return MacroInfo.getRate(13522)
  }
}
