export interface Report {
  year: number
  rank: number
  dataReferencia: string
  tipo: string
  especie: string
  assunto: string
  linkPdf: string
  dataReferencia_F: string
}

export interface RootReport {
  data: Report[]
  success: boolean
}

export interface ReportReturn {
  year: string
  rank: number
  referenceDate: string
  type: string
  especie: string
  assunt: string
  linkPdf: string
}
