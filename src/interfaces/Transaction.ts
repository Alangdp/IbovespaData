export type TransactionType  = "BUY" | "SELL";

export interface TransactionsProps {
  ticker: string
  transactionDate: Date
  transactionDateString: Date
  quantity: number
  price: number
  type: TransactionType
}

export interface TransactionHistory {
  getTicker(): string;
  getTransactionDate(): Date;
  getTransactionDateString(): string;
  getQuantity(): number;
  getPrice(): number;
  getType(): string;
}
