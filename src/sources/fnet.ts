import axios from 'axios'
import { extractText, getDocumentProxy } from 'unpdf'

const BASE_URL = 'https://fnet.bmfbovespa.com.br/fnet/publico'

/** Categoria "Relatórios", tipo "Relatório Gerencial" no FNET */
const RELATORIOS = 7
const RELATORIO_GERENCIAL = 9

/** O FNET fica atrás do Cloudflare e recusa user-agents de API */
const HEADERS = { 'User-Agent': 'Mozilla/5.0' }

/** Documento publicado no FNET */
export interface FnetDocumento {
  id: number
  /** Ex.: 31/07/2026 */
  dataReferencia: string
}

interface FnetSearchResponse {
  data: {
    id: number
    dataReferencia: string
    descricaoStatus: string
  }[]
}

/**
 * Busca o relatório gerencial mais recente e ativo do fundo
 *
 * @param cnpj - CNPJ do fundo, só dígitos
 * @returns O documento, ou `null` se o fundo não publicou nenhum
 */
export async function fetchLatestRelatorioGerencial(
  cnpj: string,
): Promise<FnetDocumento | null> {
  const { data } = await axios.get<FnetSearchResponse>(
    `${BASE_URL}/pesquisarGerenciadorDocumentosDados`,
    {
      params: {
        d: 1,
        s: 0,
        l: 5,
        'o[0][dataEntrega]': 'desc',
        cnpjFundo: cnpj,
        idCategoriaDocumento: RELATORIOS,
        idTipoDocumento: RELATORIO_GERENCIAL,
        idEspecieDocumento: 0,
        tipoFundo: 1,
      },
      headers: HEADERS,
      timeout: 30_000,
    },
  )

  // Retorna o primeiro documento ativo (os inativos foram reapresentados)
  const documento = data.data.find((doc) =>
    doc.descricaoStatus.startsWith('Ativo'),
  )
  return documento
    ? { id: documento.id, dataReferencia: documento.dataReferencia }
    : null
}

/**
 * Baixa o PDF de um documento do FNET e extrai o texto de todas as páginas
 */
export async function fetchDocumentoTexto(id: number): Promise<string> {
  const { data } = await axios.get<ArrayBuffer>(
    `${BASE_URL}/downloadDocumento`,
    {
      params: { id },
      responseType: 'arraybuffer',
      headers: HEADERS,
      timeout: 90_000,
    },
  )

  // Extrai o texto sem os avisos de fonte do pdf.js
  const pdf = await getDocumentProxy(new Uint8Array(data), { verbosity: 0 })
  const { text } = await extractText(pdf, { mergePages: true })
  return text
}
