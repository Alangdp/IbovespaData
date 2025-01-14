export class CustomError extends Error {
  public customCode: number

  constructor(message: string, customCode: number) {
    super(message)
    this.customCode = customCode
    this.name = 'CustomError'
  }
}
