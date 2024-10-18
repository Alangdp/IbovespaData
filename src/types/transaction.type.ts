// DEFAULT DATE FORMAT "11/12/2023"

export interface TransactionsProps {
  id: number
  ticker: string
  transactionDate: Date
  price: number
  quantity: number
  totalValue: number
  type: string
  userId: number
  createdAt: string
  updatedAt: string
}
