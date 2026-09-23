import type { BrapiHistoricalCandle } from '../types/Brapi.type.js'
import type { Segmento } from '../types/fundo.types.js'
import MathUtils from './MathUtils.js'

const SEGMENTO_MAP: Record<string, Segmento> = {
  tijolo: 'Tijolo',
  papel: 'Papel',
  hibrido: 'Híbrido',
  híbrido: 'Híbrido',
  fof: 'FoF',
}

export default class FundoUtils {
  static round(value: number, decimals = 2): number {
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
  }

  // segmentType da brapi vem em minúsculo ('tijolo', 'papel', 'hibrido', 'fof').
  // O contrato exige exatamente 'Tijolo' | 'Papel' | 'Híbrido' | 'FoF'.
  static mapSegmento(segmentType: string | null | undefined): Segmento | null {
    if (!segmentType) return null
    return SEGMENTO_MAP[segmentType.toLowerCase()] ?? null
  }

  // Converte uma fração (0.0843) em percentual (8.43), como o contrato espera
  // para dividend_yield_12m, vacancia_fisica, taxa_administracao e ltv_medio.
  static toPercent(value: number | null | undefined): number | null {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return null
    }
    return FundoUtils.round(value * 100, 4)
  }

  // adminFeeRate no /reports da brapi é a taxa referente ao mês do relatório
  // (accrual mensal), não a taxa anual. Anualiza multiplicando por 12 antes
  // de converter para percentual. Aproximação assumida — ver observação no
  // controller/README sobre este campo.
  static annualizeMonthlyRate(
    monthlyRate: number | null | undefined,
  ): number | null {
    if (monthlyRate === null || monthlyRate === undefined) return null
    return monthlyRate * 12
  }

  // R$ negociados/dia (média) a partir do candle diário mais recente da
  // brapi (/historical): close * volume, médio nos últimos `days` pregões.
  static computeLiquidezDiaria(
    candles: BrapiHistoricalCandle[] | undefined,
    days = 21,
  ): number | null {
    if (!candles || candles.length === 0) return null

    const recent = candles.slice(0, days)
    const dailyValues = recent
      .filter(
        (candle) =>
          typeof candle.close === 'number' && typeof candle.volume === 'number',
      )
      .map((candle) => candle.close * candle.volume)

    if (dailyValues.length === 0) return null

    return FundoUtils.round(MathUtils.makeAverage(dailyValues), 2)
  }

  // Descrição curta gerada só a partir de dados reais já buscados (nome,
  // segmento, subsegmento, gestora, mandato) — não inventa fatos sobre o
  // fundo, só resume o que a própria resposta já traz.
  static buildDescricao(props: {
    nome: string
    segmento: Segmento
    subsegmento: string | null
    gestora: string | null
    mandate?: string | null
  }): string {
    const partes = [
      `${props.nome} é um fundo imobiliário do segmento ${props.segmento}`,
    ]

    if (props.subsegmento) partes.push(`atuação em ${props.subsegmento}`)
    if (props.gestora) partes.push(`administrado por ${props.gestora}`)
    if (props.mandate) partes.push(`mandato de ${props.mandate}`)

    return `${partes.join(', ')}.`
  }
}
