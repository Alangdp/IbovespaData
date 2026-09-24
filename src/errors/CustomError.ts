/** Erro da aplicação com o status HTTP que a resposta deve usar */
export class CustomError extends Error {
  /** Status HTTP da resposta */
  public customCode: number

  constructor(message: string, customCode: number) {
    super(message)
    this.customCode = customCode
    this.name = 'CustomError'
  }
}
