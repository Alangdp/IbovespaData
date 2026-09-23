export default class Utilities {
  // Converte números no formato dos sites brasileiros ("R$ 12,50", "7,39%",
  // "1.234.567") para number. Texto sem dígitos vira 0.
  static formateNumber(stringToFormat: string): number {
    const stringToFormatArray = stringToFormat.split('.')
    if (stringToFormatArray.length > 2)
      return Number(stringToFormatArray.join(''))

    return Number(stringToFormat.replace(/[^\d,.]/g, '').replace(',', '.'))
  }
}
