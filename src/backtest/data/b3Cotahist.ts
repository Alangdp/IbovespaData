import { Inflate } from 'fflate'

import type { PrecoLinha } from './MarketDatabase.js'

/** Série histórica anual de cotações da B3 */
export function cotahistUrl(ano: number): string {
  return `https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A${ano}.ZIP`
}

/** Campos da linha usados no filtro */
export interface CotahistChave {
  /** Código BDI (12 = FII, 14 = ETF/FIP, 02 = lote padrão de ações) */
  codbdi: string
  /**
   * Tipo do papel na especificação (CI = cota, DIR = direito, ON/PN...), sem
   * as marcas que vêm depois (ex.: "CI  ER" no período ex-rendimento)
   */
  especi: string
  ticker: string
}

/** Lê o preço com 2 casas implícitas */
function preco(texto: string): number {
  return Number(texto) / 100
}

/**
 * Lê uma linha do COTAHIST (layout fixo de 245 posições)
 *
 * Só aceita o mercado à vista (TPMERC 010) e as linhas aprovadas pelo filtro
 *
 * @returns `null` para o cabeçalho, o rodapé e as linhas recusadas
 */
export function parseCotahistLinha(
  linha: string,
  aceita: (chave: CotahistChave) => boolean,
): PrecoLinha | null {
  // Se não é registro de cotação ou não é do mercado à vista
  if (!linha.startsWith('01') || linha.slice(24, 27) !== '010') {
    return null
  }
  const chave: CotahistChave = {
    codbdi: linha.slice(10, 12),
    especi: linha.slice(39, 49).trim().split(/\s+/)[0],
    ticker: linha.slice(12, 24).trim(),
  }
  // Se o papel não interessa
  if (!aceita(chave)) {
    return null
  }

  const data = linha.slice(2, 10)
  return {
    ativoId: linha.slice(230, 242).trim(),
    data: `${data.slice(0, 4)}-${data.slice(4, 6)}-${data.slice(6, 8)}`,
    ticker: chave.ticker,
    codbdi: chave.codbdi,
    nome: linha.slice(27, 39).trim(),
    fechamento: preco(linha.slice(108, 121)),
    volume: preco(linha.slice(170, 188)),
    negocios: Number(linha.slice(147, 152)),
  }
}

/**
 * Baixa o COTAHIST do ano e entrega as linhas aceitas em lotes, sem descompactar
 * o arquivo inteiro na memória (o TXT de um ano recente passa de 700 MB)
 *
 * @param onLote - Recebe cada lote de linhas lidas
 * @returns Total de linhas aceitas; 0 se o ano não existir
 */
export async function baixarCotahist(
  ano: number,
  aceita: (chave: CotahistChave) => boolean,
  onLote: (linhas: PrecoLinha[]) => void,
  tamanhoLote = 20_000,
): Promise<number> {
  const response = await fetch(cotahistUrl(ano))
  // Se o ano não existe
  if (response.status === 404) {
    return 0
  }
  if (!response.ok) {
    throw new Error(`COTAHIST ${ano}: HTTP ${response.status}`)
  }

  const decoder = new TextDecoder('latin1')
  let resto = ''
  let lote: PrecoLinha[] = []
  let total = 0

  // Lê as linhas completas do texto e guarda o pedaço da última
  const processar = (texto: string, fim: boolean) => {
    const linhas = (resto + texto).split('\n')
    resto = fim ? '' : (linhas.pop() ?? '')
    for (const linha of linhas) {
      const registro = parseCotahistLinha(linha, aceita)
      if (registro) {
        lote.push(registro)
        total++
      }
      if (lote.length >= tamanhoLote) {
        onLote(lote)
        lote = []
      }
    }
  }

  // Baixa o zip (até ~90 MB) e localiza o início dos dados comprimidos pelo
  // cabeçalho local; os zips recentes usam "data descriptor" (tamanho zerado
  // no cabeçalho), mas o deflate marca o próprio fim
  const zip = new Uint8Array(await response.arrayBuffer())
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  // Se o arquivo não começa com um cabeçalho local de zip com deflate
  if (view.getUint32(0, true) !== 0x04034b50 || view.getUint16(8, true) !== 8) {
    throw new Error(`COTAHIST ${ano}: formato de zip inesperado`)
  }
  const inicio = 30 + view.getUint16(26, true) + view.getUint16(28, true)

  // Descomprime em pedaços, processando as linhas conforme saem
  const inflate = new Inflate((chunk, final) => {
    processar(decoder.decode(chunk, { stream: !final }), final)
  })
  const pedaco = 1 << 20
  for (let pos = inicio; pos < zip.length; pos += pedaco) {
    inflate.push(zip.subarray(pos, pos + pedaco), pos + pedaco >= zip.length)
  }

  // Entrega o último lote
  if (lote.length > 0) {
    onLote(lote)
  }
  return total
}
