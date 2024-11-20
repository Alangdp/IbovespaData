// FIXME Revisar SOLID mais tarde
export class DateFormatter {
  static dateToString(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    const addZero = (value: number) => {
      return value < 10 ? '0' + value : value;
    };

    return `${addZero(day)}/${addZero(month + 1)}/${year}`;
  }

  static stringToDate(dataString: string): Date | null {
    if (dataString.includes('00:00'))
      dataString = dataString.replace('00:00', '').trim();

    const partes = dataString.split('/');

    if (partes.length !== 3) {
      console.error('Date format invalid, use: "dd/mm/yyyy".');
      return null;
    }

    const [day, month, year] = partes.map(Number);

    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      return null;
    }
    const date = new Date(year > 100 ? year : year + 2000, month - 1, day);

    return date;
  }
}
