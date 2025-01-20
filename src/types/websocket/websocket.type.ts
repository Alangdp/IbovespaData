enum WebsocketTypes {
  GET_PRICE_REQUEST = 'GET_PRICE_REQUEST',
  GET_PRICE_RESPONSE = 'GET_PRICE_RESPONSE',
}

export interface WebsocketPayload<T> {
  connectionId: string
  type: WebsocketTypes
  payload: {
    time: number
    data: T
  }
}
