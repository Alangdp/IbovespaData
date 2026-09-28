import type { FiiListItem, FiiProperty } from '../types/fii.type.js'
import type { Segmento } from '../types/fundo.types.js'

/** Setor do statusinvest para o segmento do contrato */
const SEGMENTO_MAP: Record<string, Segmento> = {
  'Fundo de Tijolo': 'Tijolo',
  'Fundo de Papel': 'Papel',
  'Fundo Misto': 'Híbrido',
}

/** Conversões dos dados do statusinvest para o contrato de FII */
export default class FundoUtils {
  /** Arredonda para `decimals` casas decimais */
  static round(value: number, decimals = 2): number {
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
  }

  /** Arredonda o valor, mantendo `null` quando ele não vier */
  static roundOrNull(
    value: number | null | undefined,
    decimals = 2,
  ): number | null {
    return value === null || value === undefined
      ? null
      : FundoUtils.round(value, decimals)
  }

  /**
   * Converte o setor do statusinvest no segmento do contrato
   * ('Tijolo' | 'Papel' | 'Híbrido' | 'FoF')
   *
   * @returns `null` para setores fora do contrato (Fiagro, FI-Infra...)
   */
  static mapSegmento(
    item: Pick<FiiListItem, 'sectorname' | 'subsectorname'>,
  ): Segmento | null {
    // Se é fundo de fundos (o statusinvest classifica como papel)
    if (item.subsectorname === 'Fundo de Fundos') {
      return 'FoF'
    }
    return SEGMENTO_MAP[item.sectorname] ?? null
  }

  /**
   * Calcula a vacância física do portfólio, ponderada pela área de cada imóvel
   *
   * @returns `null` se nenhum imóvel informar área e vacância
   */
  static computeVacancia(imoveis: FiiProperty[] | null): number | null {
    // Carrega os imóveis com área e vacância informadas
    const withData = (imoveis ?? []).filter(
      (imovel) => imovel.area !== null && imovel.vacancia !== null,
    )
    // Se nenhum imóvel informa os dois dados
    if (withData.length === 0) {
      return null
    }

    // Soma a área vaga de cada imóvel e divide pela área total
    let totalArea = 0
    let vacantArea = 0
    for (const imovel of withData) {
      totalArea += imovel.area ?? 0
      vacantArea += ((imovel.area ?? 0) * (imovel.vacancia ?? 0)) / 100
    }
    // Se a área total é zero
    if (totalArea === 0) {
      return null
    }
    return FundoUtils.round((vacantArea / totalArea) * 100, 4)
  }

  /**
   * Soma a área dos imóveis do portfólio (m²)
   *
   * @returns `null` se nenhum imóvel informar área
   */
  static computeAreaTotal(imoveis: FiiProperty[] | null): number | null {
    const areas = (imoveis ?? [])
      .map((imovel) => imovel.area)
      .filter((area): area is number => area !== null)
    // Se nenhum imóvel informa área
    if (areas.length === 0) {
      return null
    }
    return FundoUtils.round(
      areas.reduce((acc, area) => acc + area, 0),
      2,
    )
  }

  /**
   * Monta uma descrição curta só com dados reais já buscados (nome, segmento,
   * subsegmento, administradora) — não inventa fatos sobre o fundo
   */
  static buildDescricao(props: {
    nome: string
    segmento: Segmento
    subsegmento: string | null
    administradora: string | null
  }): string {
    // Adiciona cada informação disponível à frase
    const partes = [
      `${props.nome} é um fundo imobiliário do segmento ${props.segmento}`,
    ]

    if (props.subsegmento) {
      partes.push(`atuação em ${props.subsegmento}`)
    }
    if (props.administradora) {
      partes.push(`administrado por ${props.administradora}`)
    }

    return `${partes.join(', ')}.`
  }
}
