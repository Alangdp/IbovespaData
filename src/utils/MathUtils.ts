/** Funções estatísticas e de formatação numérica */
export default class MathUtils {
  /** Calcula a mediana da lista, sem alterar a lista recebida */
  static makeMedian(array: number[]) {
    const sortedArray = array.toSorted((a, b) => a - b)
    const middleIndex = sortedArray.length / 2

    // Se a quantidade é par, usa a média dos dois do meio
    if (sortedArray.length % 2 === 0) {
      return (sortedArray[middleIndex] + sortedArray[middleIndex - 1]) / 2
    }

    return sortedArray[Math.floor(middleIndex)]
  }

  /** Calcula a média aritmética da lista (`NaN` se ela estiver vazia) */
  static makeAverage(array: number[]) {
    return array.reduce((acc, curr) => acc + curr, 0) / array.length
  }

  /**
   * Abrevia o número com sufixo e sem casas decimais (1500 vira `2K`)
   *
   * @returns String vazia para valores abaixo de 1000
   */
  static abbreviateNumber(value: number): string {
    // Se o valor não precisa de abreviação
    if (value < 1000) {
      return ''
    }

    const suffixes = ['', 'K', 'M', 'B', 'T']
    const suffixNum = Math.floor(Math.log10(value) / 3)
    return `${(value / 1000 ** suffixNum).toFixed(0)}${suffixes[suffixNum]}`
  }
}
