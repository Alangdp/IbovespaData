import { CRITERIOS } from '../config/fiiCriterios.js'
import type { CvmFundo, CvmImovel } from '../types/cvm.type.js'
import type { Segmento } from '../types/fundo.types.js'

/** Classe de ativo usada na regra de diversificação */
export type ClasseDiversificacao = 'imoveis' | 'cri' | 'fii'

/** Um critério da regra, com o valor apurado e o limite */
export interface Criterio {
  criterio: string
  valor: number | null
  limite: number
  tipo: 'minimo' | 'maximo'
  /** `null` quando falta dado para avaliar */
  ok: boolean | null
  /** De onde saiu o valor, quando há mais de uma fonte possível */
  base?: string
}

/** Resultado da regra de diversificação, com os critérios avaliados */
export interface Diversificacao {
  diversificado: boolean | null
  classe: ClasseDiversificacao | null
  /** Data do informe usado */
  data: string | null
  criterios: Criterio[]
}

/** Imóvel na avaliação da localização */
export interface ImovelLocalizacao {
  nome: string
  cidade: string | null
  area: number
  boa: boolean | null
}

/** Resultado da regra de localização */
export interface Localizacao {
  boa_localizacao: boolean | null
  /** Parte da área (classificada) em cidades boas, em % */
  percentual_area_boa: number | null
  /** Parte da área com cidade classificada, em % */
  percentual_area_classificada: number | null
  imoveis: ImovelLocalizacao[]
}

const SEM_DIVERSIFICACAO: Diversificacao = {
  diversificado: null,
  classe: null,
  data: null,
  criterios: [],
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Monta um critério comparando o valor com o limite */
function criterio(
  nome: string,
  valor: number | null,
  limite: number,
  tipo: 'minimo' | 'maximo',
  base?: string,
): Criterio {
  let ok: boolean | null = null
  if (valor !== null) {
    ok = tipo === 'minimo' ? valor >= limite : valor <= limite
  }
  return {
    criterio: nome,
    valor,
    limite,
    tipo,
    ok,
    ...(base ? { base } : {}),
  }
}

/** Qualquer critério reprovado reprova; sem reprovação, falta de dado é null */
function combinar(criterios: Criterio[]): boolean | null {
  if (criterios.some((c) => c.ok === false)) {
    return false
  }
  if (criterios.some((c) => c.ok === null)) {
    return null
  }
  return true
}

/**
 * Escolhe a classe de ativo da regra: pelo segmento ou, no híbrido, pela
 * classe com mais dinheiro no informe mensal
 */
function classeDaRegra(
  segmento: Segmento,
  cvm: CvmFundo,
): ClasseDiversificacao | null {
  if (segmento === 'Tijolo') {
    return 'imoveis'
  }
  if (segmento === 'Papel') {
    return 'cri'
  }
  if (segmento === 'FoF') {
    return 'fii'
  }

  // Se o híbrido não tem a composição do ativo informada
  const composicao = cvm.composicao
  if (!composicao) {
    return null
  }
  const classes: [ClasseDiversificacao, number][] = [
    ['imoveis', composicao.imoveis],
    ['cri', composicao.cri],
    ['fii', composicao.fii],
  ]
  const [classe, valor] = classes.reduce((maior, atual) =>
    atual[1] > maior[1] ? atual : maior,
  )
  return valor > 0 ? classe : null
}

/**
 * Calcula a maior participação de um imóvel, pela receita ou, se nenhum
 * imóvel informar receita, pela área
 */
function maiorParticipacao(
  imoveis: CvmImovel[],
): { valor: number; base: string } | null {
  const receitas = imoveis.map((i) => i.receita ?? 0)
  const totalReceita = receitas.reduce((sum, value) => sum + value, 0)
  if (totalReceita > 0) {
    return {
      valor: round((Math.max(...receitas) / totalReceita) * 100, 2),
      base: 'receita',
    }
  }

  const areas = imoveis.map((i) => i.area)
  const totalArea = areas.reduce((sum, value) => sum + value, 0)
  if (totalArea > 0) {
    return {
      valor: round((Math.max(...areas) / totalArea) * 100, 2),
      base: 'area',
    }
  }
  return null
}

/** Critérios de um fundo de imóveis */
function criteriosImoveis(cvm: CvmFundo): Criterio[] {
  const regra = CRITERIOS.diversificado.tijolo
  const imoveis = cvm.imoveis
  const participacao = imoveis.length > 0 ? maiorParticipacao(imoveis) : null

  // Conta os estados; com imóveis sem cidade, abaixo do mínimo é incerto
  const ufs = new Set(imoveis.map((i) => i.uf).filter(Boolean))
  const todosComUf = imoveis.every((i) => i.uf !== null)
  const estados = criterio(
    'estados',
    imoveis.length > 0 ? ufs.size : null,
    regra.minEstados,
    'minimo',
  )
  if (estados.ok === false && !todosComUf) {
    estados.ok = null
  }

  return [
    criterio(
      'quantidade_imoveis',
      cvm.imoveisData ? imoveis.length : null,
      regra.minImoveis,
      'minimo',
    ),
    criterio(
      'maior_participacao_imovel',
      participacao?.valor ?? null,
      regra.maxParticipacao,
      'maximo',
      participacao?.base,
    ),
    estados,
  ]
}

/** Critérios de uma carteira de títulos (CRIs ou FIIs) */
function criteriosCarteira(cvm: CvmFundo, classe: 'cri' | 'fii'): Criterio[] {
  const regra =
    classe === 'cri'
      ? CRITERIOS.diversificado.papel
      : CRITERIOS.diversificado.fof
  const carteira = cvm.carteira
  const posicoes = carteira?.[classe]
  const patrimonio = carteira?.patrimonio ?? null

  return [
    criterio(
      classe === 'cri' ? 'quantidade_cri' : 'quantidade_fii',
      posicoes ? posicoes.quantidade : null,
      regra.minAtivos,
      'minimo',
    ),
    criterio(
      classe === 'cri' ? 'maior_cri_sobre_pl' : 'maior_fii_sobre_pl',
      posicoes && patrimonio && patrimonio > 0
        ? round((posicoes.maior / patrimonio) * 100, 2)
        : null,
      regra.maxParticipacaoPl,
      'maximo',
    ),
  ]
}

/** Critérios de qualidade dos FIIs a partir dos informes da CVM */
export default class FiiQualidade {
  /**
   * Avalia se o fundo é diversificado, pela regra da classe de ativo:
   * - imóveis: mínimo de imóveis, nenhum com receita (ou área) demais e
   *   imóveis em mais de um estado
   * - CRIs e FIIs: mínimo de ativos e nenhum com patrimônio demais
   *
   * @returns `diversificado: null` quando falta dado para avaliar
   */
  static diversificacao(
    segmento: Segmento,
    cvm: CvmFundo | null,
  ): Diversificacao {
    // Se o fundo não tem informes na CVM
    if (!cvm) {
      return SEM_DIVERSIFICACAO
    }
    const classe = classeDaRegra(segmento, cvm)
    // Se não há classe de ativo para avaliar
    if (!classe) {
      return SEM_DIVERSIFICACAO
    }

    const criterios =
      classe === 'imoveis'
        ? criteriosImoveis(cvm)
        : criteriosCarteira(cvm, classe)
    return {
      diversificado: combinar(criterios),
      classe,
      data:
        classe === 'imoveis' ? cvm.imoveisData : (cvm.carteira?.data ?? null),
      criterios,
    }
  }

  /**
   * Avalia se o fundo tem boa localização: parte mínima da área em cidades
   * classificadas como boas (ver `CvmRegiao`)
   *
   * Só vale para Tijolo e Híbrido; a área é o peso de cada imóvel (sem área
   * informada, todos pesam igual)
   *
   * @returns `boa_localizacao: null` quando pouca área tem cidade classificada
   */
  static localizacao(segmento: Segmento, cvm: CvmFundo | null): Localizacao {
    const imoveis = (cvm?.imoveis ?? []).map(
      (imovel): ImovelLocalizacao => ({
        nome: imovel.nome,
        cidade: imovel.cidade,
        area: imovel.area,
        boa: imovel.boaLocalizacao,
      }),
    )
    const vazio: Localizacao = {
      boa_localizacao: null,
      percentual_area_boa: null,
      percentual_area_classificada: null,
      imoveis,
    }
    // Se o fundo não é de imóveis ou não tem imóveis informados
    if ((segmento !== 'Tijolo' && segmento !== 'Híbrido') || !imoveis.length) {
      return vazio
    }

    // Soma o peso total, o classificado e o das cidades boas
    const usaArea = imoveis.some((imovel) => imovel.area > 0)
    const peso = (imovel: ImovelLocalizacao) => (usaArea ? imovel.area : 1)
    let total = 0
    let classificado = 0
    let boa = 0
    for (const imovel of imoveis) {
      total += peso(imovel)
      if (imovel.boa !== null) {
        classificado += peso(imovel)
      }
      if (imovel.boa) {
        boa += peso(imovel)
      }
    }

    const { minAreaBoa, minAreaClassificada } = CRITERIOS.localizacao
    const percentualClassificado = (classificado / total) * 100
    // Se pouca área tem cidade classificada
    if (classificado === 0 || percentualClassificado < minAreaClassificada) {
      return {
        ...vazio,
        percentual_area_classificada: round(percentualClassificado, 2),
      }
    }

    const percentualBoa = (boa / classificado) * 100
    return {
      boa_localizacao: percentualBoa >= minAreaBoa,
      percentual_area_boa: round(percentualBoa, 2),
      percentual_area_classificada: round(percentualClassificado, 2),
      imoveis,
    }
  }
}
