import type { Municipio } from '../sources/ibge.js'

const UFS = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
])

/** Prefixo que alguns endereços põem antes da cidade ("Município de Resende") */
const PREFIXO_MUNICIPIO = /^(MUNICIPIO|CIDADE) D[AEO] /

/**
 * Municípios cujo nome é também bairro comum nas capitais; só são aceitos
 * quando o endereço traz a UF logo depois
 */
const NOMES_DE_BAIRRO = new Set([
  'JARDIM',
  'PARAISO',
  'SANTO AMARO',
  'BELA VISTA',
  'LAPA',
  'PINHEIROS',
  'CAMPO BELO',
  'BARRA',
  'CENTRO',
])

/** Maiúsculas, sem acento e só letras/dígitos separados por um espaço */
export function normalizeNome(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

/** Identifica o município de um endereço em texto livre */
export class CidadeResolver {
  private readonly porNome = new Map<string, Municipio[]>()
  private readonly maxPalavras: number

  constructor(municipios: Municipio[]) {
    let maxPalavras = 1
    for (const municipio of municipios) {
      const nome = normalizeNome(municipio.nome)
      this.porNome.set(nome, [...(this.porNome.get(nome) ?? []), municipio])
      maxPalavras = Math.max(maxPalavras, nome.split(' ').length)
    }
    this.maxPalavras = maxPalavras
  }

  /**
   * Busca o município do endereço
   *
   * Primeiro procura "Cidade/UF" ("Extrema/MG", "Campinas - SP"); sem isso,
   * procura um trecho do endereço que seja só o nome de um município
   * ("Tamboré, Barueri")
   *
   * @returns `null` se não encontrar ou se o nome for ambíguo
   */
  resolve(endereco: string): Municipio | null {
    const tokens = normalizeNome(endereco).split(' ').filter(Boolean)
    return this.porUf(tokens) ?? this.porTrecho(endereco)
  }

  /** Procura o nome que vem logo antes de uma UF, da última para a primeira */
  private porUf(tokens: string[]): Municipio | null {
    for (let index = tokens.length - 1; index > 0; index--) {
      const uf = tokens[index]
      // Se o token não é uma UF
      if (!UFS.has(uf)) {
        continue
      }

      // Tenta do nome mais longo para o mais curto
      for (let size = Math.min(this.maxPalavras, index); size > 0; size--) {
        const nome = tokens.slice(index - size, index).join(' ')
        const municipios = this.porNome.get(nome)
        // Se o nome não é de município
        if (!municipios) {
          continue
        }
        const naUf = municipios.find((municipio) => municipio.uf === uf)
        if (naUf) {
          return naUf
        }
        // Se a UF do endereço está errada mas o nome é único no país
        if (municipios.length === 1 && !NOMES_DE_BAIRRO.has(nome)) {
          return municipios[0]
        }
      }
    }
    return null
  }

  /**
   * Procura, do último para o primeiro, um trecho entre vírgulas, hífens ou
   * barras que seja só o nome de um município (a cidade costuma vir depois
   * da rua e do bairro)
   */
  private porTrecho(endereco: string): Municipio | null {
    const trechos = endereco
      .split(/[,;/()–-]| - /)
      .map((trecho) => normalizeNome(trecho).replace(PREFIXO_MUNICIPIO, ''))
      .filter(Boolean)
      .reverse()

    for (const nome of trechos) {
      const municipios = this.porNome.get(nome)
      // Se o trecho não é nome de município ou é nome comum de bairro
      if (!municipios || NOMES_DE_BAIRRO.has(nome)) {
        continue
      }
      // Se o nome existe em mais de uma UF, não dá para escolher
      return municipios.length === 1 ? municipios[0] : null
    }
    return null
  }
}
