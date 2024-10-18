export default class MathUtils {
  static makeMedian(array: number[]) {
    const sortedArray = array.sort();
    const middleIndex = sortedArray.length / 2;

    if (sortedArray.length % 2 === 0) {
      return (sortedArray[middleIndex] + sortedArray[middleIndex - 1]) / 2;
    }

    return sortedArray[Math.floor(middleIndex)];
  }

  static makeAverage(array: number[]) {
    return array.reduce((acc, curr) => acc + curr, 0) / array.length;
  }

  static abbreviateNumber(value: number): string {
    let newValue: string = '';
    if (value >= 1000) {
        const suffixes: string[] = ['', 'K', 'M', 'B', 'T'];
        const suffixNum: number = Math.floor(Math.log10(value) / 3);
        let shortValue: number | string = (value / Math.pow(1000, suffixNum)).toFixed(0);

        if (typeof shortValue !== 'number') {
          shortValue = parseFloat(shortValue).toFixed(0);
        }

        newValue = `${shortValue}${suffixes[suffixNum]}`;
    }

    return newValue;
}

}
