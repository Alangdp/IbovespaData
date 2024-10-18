export interface StockQuery {
  id: number
  parentId: number
  nameFormated: string
  name: string
  code: string
  price: string
  variation: string
  variationUp: boolean
  type: number
  url: string
}
