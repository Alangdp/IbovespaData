/** Conversões de texto usadas no scraping */
export default class Utilities {
  /**
   * Converte números no formato dos sites brasileiros ("R$ 12,50", "7,39%",
   * "1.234.567", "58.671,52", "-0,19%") para number
   *
   * @returns 0 para texto sem dígitos
   */
  static formateNumber(stringToFormat: string): number {
    // Se o texto não tem número
    if (!/\d/.test(stringToFormat)) {
      return 0
    }

    // Remove símbolos, mantendo dígitos, separadores e sinal
    const cleaned = stringToFormat.replace(/[^\d,.-]/g, '')

    // Se tem vírgula, ela é o decimal e os pontos são separadores de milhar
    if (cleaned.includes(',')) {
      return Number(cleaned.replaceAll('.', '').replace(',', '.'))
    }

    // Se tem mais de um ponto, os pontos são separadores de milhar
    if (cleaned.split('.').length > 2) {
      return Number(cleaned.replaceAll('.', ''))
    }

    return Number(cleaned)
  }
}
