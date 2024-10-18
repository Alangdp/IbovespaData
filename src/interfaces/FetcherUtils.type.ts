type CherioElement = cheerio.Cheerio;

export interface FetcherUtilsProtocol {
  // $?: cheerio.Root;

  extractText(selector: string): string;
  extractElement(selector: string): CherioElement | undefined;
  extractImage(selector: string): string;
  extractNumber(selector: string): number;
}
