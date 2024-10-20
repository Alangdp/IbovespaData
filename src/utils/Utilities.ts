// Alter import type

// Não existe funções ou váriavies em interfaces Typescript
// Logo torna inviável a criação de um Protocol para a classe de utilidades.
// FIXME Revisar SOLID mais tarde

export default class Utilities {
  static formateNumber(stringToFormat: string): number {
    const stringToFormatArray = stringToFormat.split('.');
    if (stringToFormatArray.length > 2)
      return Number(stringToFormatArray.join(''));
    stringToFormat = stringToFormat.replace(/[^\d,.]/g, '');
    stringToFormat = stringToFormat.replace(',', '.');

    try {
      return Number(stringToFormat);
    } catch (err: any) {
      throw new Error('Invalid String');
    }
  }

  static msToHours(ms: number): number {
    return ms / (1000 * 60 * 60);
  }

  static uniqueElements<T>(array: T[]): T[] {
    return array.filter((value, index, self) => self.indexOf(value) === index);
  }

  static findIndexOfGreatest(array: number[]): number {
    var greatest;
    var indexOfGreatest = -1;
    for (var i = 0; i < array.length; i++) {
      if (!greatest || array[i] > greatest) {
        greatest = array[i];
        indexOfGreatest = i;
      }
    }
    return indexOfGreatest;
  }

  static removeKeyRecursively(obj: any, keyToRemove: string): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.removeKeyRecursively(item, keyToRemove));
    } else if (typeof obj === 'object' && obj !== null) {
      // Verifica se o objeto tem a chave e ignora se for um documento do mongoose
      if (obj.constructor && obj.constructor.name !== 'Object') {
        return obj;
      }

      return Object.keys(obj).reduce((acc, key) => {
        if (key !== keyToRemove) {
          acc[key] = this.removeKeyRecursively(obj[key], keyToRemove);
        }
        return acc;
      }, {} as any);
    }

    return obj;
  }
}
