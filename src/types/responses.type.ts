/** Erro devolvido no campo `errors` das respostas da API */
export interface ErrorResponse {
  message: string
  data?: unknown
}

/** Corpo padrão das respostas da API */
export interface ResponseProps<T> {
  status: number
  data?: T
  errors?: ErrorResponse[]
}
