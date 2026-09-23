export interface FetcherUtilsProtocol {
  extractText(selector: string): string
  extractImage(selector: string): string
  extractNumber(selector: string): number
}
