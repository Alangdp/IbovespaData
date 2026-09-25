import axios from 'axios'

import { CAPITAIS } from '../config/fiiCriterios.js'

const LOCALIDADES_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades'

/** População residente do Censo 2022 (agregado 4709, variável 93) */
const POPULACAO_URL =
  'https://servicodados.ibge.gov.br/api/v3/agregados/4709/periodos/2022/variaveis/93?localidades=N6[all]'

/** Município do IBGE, com os dados usados no plano B da localização */
export interface Municipio {
  id: number
  nome: string
  uf: string
  /** Censo 2022; `null` se o IBGE não informar */
  populacao: number | null
  /** Faz parte da região metropolitana de uma capital */
  metropoleCapital: boolean
}

interface MunicipioResponse {
  'municipio-id': number
  'municipio-nome': string
  'UF-sigla': string
}

interface RegiaoMetropolitanaResponse {
  UF: { sigla: string }
  municipios: { id: number; nome: string }[]
}

type PopulacaoResponse = {
  resultados: {
    series: { localidade: { id: string }; serie: Record<string, string> }[]
  }[]
}[]

/**
 * Busca os municípios do IBGE com população e região metropolitana
 *
 * São 3 consultas (municípios, regiões metropolitanas e população); os dados
 * mudam raramente, quem chama guarda o resultado por bastante tempo
 */
export async function fetchMunicipios(): Promise<Municipio[]> {
  const options = { timeout: 120_000 }
  const { data: municipios } = await axios.get<MunicipioResponse[]>(
    `${LOCALIDADES_URL}/municipios?view=nivelado`,
    options,
  )
  const { data: regioes } = await axios.get<RegiaoMetropolitanaResponse[]>(
    `${LOCALIDADES_URL}/regioes-metropolitanas`,
    options,
  )
  const { data: populacao } = await axios.get<PopulacaoResponse>(
    POPULACAO_URL,
    options,
  )

  // Carrega a população de cada município
  const populacoes = new Map<number, number>()
  for (const serie of populacao[0]?.resultados[0]?.series ?? []) {
    const valor = Number(serie.serie['2022'])
    if (Number.isFinite(valor)) {
      populacoes.set(Number(serie.localidade.id), valor)
    }
  }

  // Carrega os municípios das regiões metropolitanas que incluem a capital
  // da UF
  const metropoles = new Set<number>()
  for (const regiao of regioes) {
    const capital = CAPITAIS[regiao.UF.sigla]
    const temCapital = regiao.municipios.some(
      (municipio) => municipio.nome === capital,
    )
    if (temCapital) {
      for (const municipio of regiao.municipios) {
        metropoles.add(municipio.id)
      }
    }
  }

  return municipios.map((municipio) => {
    const id = municipio['municipio-id']
    const uf = municipio['UF-sigla']
    return {
      id,
      nome: municipio['municipio-nome'],
      uf,
      populacao: populacoes.get(id) ?? null,
      // A capital conta mesmo sem região metropolitana cadastrada (ex.: DF)
      metropoleCapital:
        metropoles.has(id) || municipio['municipio-nome'] === CAPITAIS[uf],
    }
  })
}
