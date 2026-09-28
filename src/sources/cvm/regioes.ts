import { CRITERIOS } from '../../config/fiiCriterios.js'
import type {
  CvmFundo,
  CvmGestora,
  CvmRegiao,
  CvmRegiaoFonte,
} from '../../types/cvm.type.js'
import type { Municipio } from '../ibge.js'

/** Segmentos de atuação da CVM que viram tipo de imóvel; o resto é "Outros" */
const TIPOS = new Set([
  'Logística',
  'Escritórios',
  'Shoppings',
  'Varejo',
  'Residencial',
  'Hospital',
  'Hotel',
  'Educacional',
])

/**
 * Segmento do statusinvest para o tipo de imóvel: é mais preciso que o da
 * CVM, onde a maioria dos fundos se declara "Multicategoria"
 */
const TIPOS_STATUSINVEST: Record<string, string> = {
  'Imóveis Industriais e Logísticos': 'Logística',
  Logística: 'Logística',
  'Lajes Corporativas': 'Escritórios',
  Shoppings: 'Shoppings',
  Varejo: 'Varejo',
  'Agências de Bancos': 'Varejo',
  'Imóveis Residenciais': 'Residencial',
  Hospitalar: 'Hospital',
  Hotéis: 'Hotel',
  Educacional: 'Educacional',
}

/** Segmento do fundo no statusinvest (ver `classificarRegioes`) */
export type SegmentoDoFundo = (fundo: CvmFundo) => string | null

/**
 * Tipo de imóvel do fundo: pelo segmento do statusinvest ou, sem ele, pelo
 * segmento de atuação da CVM
 */
export function tipoImovel(
  segmentoAtuacao: string | null,
  segmentoStatusinvest: string | null = null,
): string {
  const doStatusinvest = segmentoStatusinvest
    ? TIPOS_STATUSINVEST[segmentoStatusinvest]
    : undefined
  // Se o statusinvest tem um segmento conhecido
  if (doStatusinvest) {
    return doStatusinvest
  }
  return segmentoAtuacao && TIPOS.has(segmentoAtuacao)
    ? segmentoAtuacao
    : 'Outros'
}

/** Vacâncias somadas de um grupo de imóveis */
interface Grupo {
  imoveis: number
  fundos: Set<string>
  soma: number
}

interface Classificacao {
  boa: boolean
  fonte: CvmRegiaoFonte
  vacanciaMedia: number | null
  vacanciaMercado: number | null
  imoveis: number
  fundos: number
}

/**
 * Verifica se o fundo informa tudo zerado (vacância e receita zeradas em
 * todos os imóveis de renda): a vacância dele não é confiável
 */
function informaTudoZerado(fundo: CvmFundo): boolean {
  const renda = fundo.imoveis.filter((i) => i.classe === 'renda_acabado')
  return renda.every((i) => !i.vacancia && !i.receita)
}

function addTo(
  grupos: Map<string, Grupo>,
  key: string,
  cnpj: string,
  vacancia: number,
) {
  const grupo = grupos.get(key) ?? { imoveis: 0, fundos: new Set(), soma: 0 }
  grupo.imoveis++
  grupo.fundos.add(cnpj)
  grupo.soma += vacancia
  grupos.set(key, grupo)
}

function media(grupo: Grupo | undefined): number | null {
  return grupo && grupo.imoveis > 0 ? grupo.soma / grupo.imoveis : null
}

/** Arredonda a fração para percentual com 2 casas */
function toPercent(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10_000) / 100
}

/**
 * Classifica as cidades dos imóveis de todos os FIIs e marca
 * `boaLocalizacao` em cada imóvel
 *
 * @param fundos - Fundos já com os imóveis e as cidades (altera os imóveis)
 * @param municipios - Municípios do IBGE, para o plano B
 * @param segmentoDoFundo - Segmento do fundo no statusinvest; sem ele o tipo
 * de imóvel vem só do segmento de atuação da CVM
 * @returns Uma classificação por tipo de imóvel e cidade
 */
export function classificarRegioes(
  fundos: Iterable<CvmFundo>,
  municipios: Municipio[],
  segmentoDoFundo?: SegmentoDoFundo,
): CvmRegiao[] {
  const { minImoveisCidade, minFundosCidade, minPopulacao } =
    CRITERIOS.localizacao
  const lista = [...fundos]
  const porId = new Map(municipios.map((m) => [m.id, m]))
  const tipoDo = (fundo: CvmFundo) =>
    tipoImovel(fundo.segmentoAtuacao, segmentoDoFundo?.(fundo) ?? null)

  // Soma a vacância dos imóveis de renda prontos por tipo e cidade, por
  // cidade e por tipo (mercado), ignorando fundos que informam tudo zerado
  const porTipoCidade = new Map<string, Grupo>()
  const porCidade = new Map<string, Grupo>()
  const mercadoPorTipo = new Map<string, Grupo>()
  const mercado = new Map<string, Grupo>()
  for (const fundo of lista) {
    // Se a vacância do fundo não é confiável
    if (informaTudoZerado(fundo)) {
      continue
    }
    const tipo = tipoDo(fundo)
    for (const imovel of fundo.imoveis) {
      // Se o imóvel não está pronto para renda, sem vacância ou sem cidade
      if (
        imovel.classe !== 'renda_acabado' ||
        imovel.vacancia === null ||
        imovel.municipioId === null
      ) {
        continue
      }
      addTo(
        porTipoCidade,
        `${tipo}|${imovel.municipioId}`,
        fundo.cnpj,
        imovel.vacancia,
      )
      addTo(porCidade, `${imovel.municipioId}`, fundo.cnpj, imovel.vacancia)
      addTo(mercadoPorTipo, tipo, fundo.cnpj, imovel.vacancia)
      addTo(mercado, 'todos', fundo.cnpj, imovel.vacancia)
    }
  }

  const suficiente = (grupo: Grupo | undefined) =>
    grupo !== undefined &&
    grupo.imoveis >= minImoveisCidade &&
    grupo.fundos.size >= minFundosCidade

  // Classifica a cidade para o tipo: vacância no tipo, vacância na cidade
  // ou IBGE, nessa ordem
  const classificar = (tipo: string, municipio: Municipio): Classificacao => {
    const doTipo = porTipoCidade.get(`${tipo}|${municipio.id}`)
    const daCidade = porCidade.get(`${municipio.id}`)
    const contagem = {
      imoveis: doTipo?.imoveis ?? 0,
      fundos: doTipo?.fundos.size ?? 0,
    }

    // Se a cidade tem imóveis suficientes do mesmo tipo
    const mercadoTipo = media(mercadoPorTipo.get(tipo))
    if (suficiente(doTipo) && mercadoTipo !== null) {
      const vacancia = media(doTipo) ?? 0
      return {
        boa: vacancia < mercadoTipo,
        fonte: 'vacancia_tipo',
        vacanciaMedia: vacancia,
        vacanciaMercado: mercadoTipo,
        ...contagem,
      }
    }

    // Se a cidade tem imóveis suficientes somando todos os tipos
    const mercadoTodos = media(mercado.get('todos'))
    if (suficiente(daCidade) && mercadoTodos !== null) {
      const vacancia = media(daCidade) ?? 0
      return {
        boa: vacancia < mercadoTodos,
        fonte: 'vacancia_cidade',
        vacanciaMedia: vacancia,
        vacanciaMercado: mercadoTodos,
        imoveis: daCidade?.imoveis ?? 0,
        fundos: daCidade?.fundos.size ?? 0,
      }
    }

    // Plano B: região metropolitana de capital ou cidade grande
    return {
      boa:
        municipio.metropoleCapital ||
        (municipio.populacao ?? 0) >= minPopulacao,
      fonte: 'ibge',
      vacanciaMedia: null,
      vacanciaMercado: null,
      ...contagem,
    }
  }

  // Classifica cada par tipo/cidade que aparece nos imóveis e marca os
  // imóveis
  const regioes = new Map<string, CvmRegiao>()
  for (const fundo of lista) {
    const tipo = tipoDo(fundo)
    for (const imovel of fundo.imoveis) {
      const municipio =
        imovel.municipioId === null ? undefined : porId.get(imovel.municipioId)
      // Se o imóvel não tem cidade
      if (!municipio) {
        continue
      }
      const key = `${tipo}|${municipio.id}`
      let regiao = regioes.get(key)
      if (!regiao) {
        const classificacao = classificar(tipo, municipio)
        regiao = {
          tipo,
          cidade: municipio.nome,
          uf: municipio.uf,
          municipioId: municipio.id,
          imoveis: classificacao.imoveis,
          fundos: classificacao.fundos,
          vacanciaMedia: toPercent(classificacao.vacanciaMedia),
          vacanciaMercado: toPercent(classificacao.vacanciaMercado),
          boa: classificacao.boa,
          fonte: classificacao.fonte,
        }
        regioes.set(key, regiao)
      }
      imovel.boaLocalizacao = regiao.boa
    }
  }

  return [...regioes.values()].sort(
    (a, b) =>
      a.tipo.localeCompare(b.tipo) ||
      b.imoveis - a.imoveis ||
      a.cidade.localeCompare(b.cidade),
  )
}

/** Lista as gestoras dos FIIs, da que gere mais fundos para a que gere menos */
export function listarGestoras(fundos: Iterable<CvmFundo>): CvmGestora[] {
  const gestoras = new Map<string, CvmGestora>()
  for (const fundo of fundos) {
    const gestora = fundo.gestora
    // Se o fundo não informou a gestora ou o CNPJ dela
    if (!gestora?.cnpj) {
      continue
    }
    const atual = gestoras.get(gestora.cnpj)
    if (atual) {
      atual.fundos++
    } else {
      gestoras.set(gestora.cnpj, { ...gestora, fundos: 1 })
    }
  }
  return [...gestoras.values()].sort(
    (a, b) => b.fundos - a.fundos || a.nome.localeCompare(b.nome),
  )
}
