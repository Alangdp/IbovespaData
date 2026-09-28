import axios from 'axios'
import { unzipSync } from 'fflate'

const BASE_URL = 'https://dados.cvm.gov.br/dados/FII/DOC'

/** Informes de FII publicados pela CVM */
export type CvmInforme = 'mensal' | 'trimestral' | 'anual'

const FOLDERS: Record<CvmInforme, string> = {
  mensal: 'INF_MENSAL',
  trimestral: 'INF_TRIMESTRAL',
  anual: 'INF_ANUAL',
}

/** Monta a URL do zip de um informe/ano */
export function cvmZipUrl(informe: CvmInforme, year: number): string {
  return `${BASE_URL}/${FOLDERS[informe]}/DADOS/inf_${informe}_fii_${year}.zip`
}

/**
 * Busca o ETag atual do zip (muda a cada republicação, em geral semanal)
 *
 * @returns O ETag, ou `null` se o arquivo não existir (ex.: ano sem dados)
 */
export async function fetchCvmEtag(
  informe: CvmInforme,
  year: number,
): Promise<string | null> {
  const response = await axios.head(cvmZipUrl(informe, year), {
    timeout: 30_000,
    validateStatus: (status) => status === 200 || status === 404,
  })
  // Se o arquivo não existe
  if (response.status === 404) {
    return null
  }
  return String(response.headers.etag ?? '')
}

/**
 * Baixa o zip de um informe/ano e retorna o texto dos CSVs pedidos
 *
 * @param files - Prefixos dos arquivos desejados (ex.: `inf_mensal_fii_geral`)
 * @returns Conteúdo de cada CSV encontrado, pelo prefixo; vazio se o zip não
 * existir
 */
export async function fetchCvmCsvs(
  informe: CvmInforme,
  year: number,
  files: string[],
): Promise<Record<string, string>> {
  // Baixa o zip
  const response = await axios.get<ArrayBuffer>(cvmZipUrl(informe, year), {
    responseType: 'arraybuffer',
    timeout: 120_000,
    validateStatus: (status) => status === 200 || status === 404,
  })
  // Se o arquivo não existe
  if (response.status === 404) {
    return {}
  }

  // Extrai só os CSVs pedidos (a CVM grava em latin1)
  const prefixes = files.map((file) => `${file}_${year}`)
  const unzipped = unzipSync(new Uint8Array(response.data), {
    filter: (file) => prefixes.some((prefix) => file.name.startsWith(prefix)),
  })
  const decoder = new TextDecoder('latin1')

  return Object.fromEntries(
    files
      .map((file): [string, string] | null => {
        const name = Object.keys(unzipped).find((entry) =>
          entry.startsWith(`${file}_${year}`),
        )
        return name ? [file, decoder.decode(unzipped[name])] : null
      })
      .filter((entry): entry is [string, string] => entry !== null),
  )
}
