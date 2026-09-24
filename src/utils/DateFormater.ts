/** Conversões entre `Date` e datas no formato brasileiro (`dd/mm/aaaa`) */
export class DateFormatter {
  /** Formata a data como `dd/mm/aaaa` */
  static dateToString(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${day}/${month}/${date.getFullYear()}`
  }

  /**
   * Converte `dd/mm/aaaa` ou `dd/mm/aa` (com ou sem ` 00:00`) em `Date`
   *
   * @returns `null` se o texto não estiver no formato esperado
   */
  static stringToDate(dataString: string): Date | null {
    // Remove o horário zerado, se houver
    const partes = dataString.replace('00:00', '').trim().split('/')

    // Se não tem dia, mês e ano
    if (partes.length !== 3) {
      console.error('Date format invalid, use: "dd/mm/yyyy".')
      return null
    }

    // Se alguma parte não é número
    const [day, month, year] = partes.map(Number)
    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
      return null
    }

    // Retorna a data, completando anos de 2 dígitos com 2000
    return new Date(year > 100 ? year : year + 2000, month - 1, day)
  }
}
