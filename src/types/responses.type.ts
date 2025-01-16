export interface ErrorResponse {
  message: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
}

export interface ResponseProps<T> {
  status: number
  data?: T
  errors?: ErrorResponse[]
}
