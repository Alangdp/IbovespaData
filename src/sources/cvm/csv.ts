/**
 * Lê um CSV dos dados abertos da CVM (separado por `;`, com aspas opcionais)
 *
 * @param text - Conteúdo do arquivo já decodificado
 * @returns Uma linha por registro, indexada pelo nome da coluna
 */
export function parseCsv(text: string): Record<string, string>[] {
  const [header, ...records] = splitRecords(text)
  // Se o arquivo está vazio
  if (!header) {
    return []
  }

  return records
    .filter((fields) => fields.length > 1 || fields[0] !== '')
    .map((fields) =>
      Object.fromEntries(
        header.map((column, index) => [column, fields[index] ?? '']),
      ),
    )
}

/** Separa o texto em registros e campos, respeitando campos entre aspas */
function splitRecords(text: string): string[][] {
  const records: string[][] = []
  let fields: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index++) {
    const char = text[index]

    // Se está dentro de aspas, só aspas encerram o campo
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    // Trata separadores, aspas e quebras de linha (aspas só abrem um campo
    // no início dele; no meio do texto são literais)
    if (char === '"' && field === '') {
      quoted = true
    } else if (char === ';') {
      fields.push(field)
      field = ''
    } else if (char === '\n') {
      fields.push(field.replace(/\r$/, ''))
      records.push(fields)
      fields = []
      field = ''
    } else {
      field += char
    }
  }

  // Adiciona o último registro, se o arquivo não terminar com quebra de linha
  if (field !== '' || fields.length > 0) {
    fields.push(field.replace(/\r$/, ''))
    records.push(fields)
  }

  return records
}
