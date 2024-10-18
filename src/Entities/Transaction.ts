import { TransactionType, TransactionsProps } from "../interfaces/Transaction";


class Transaction implements TransactionsProps {
  ticker: string;
  transactionDate: Date;
  transactionDateString: Date;
  quantity: number;
  price: number;
  type: TransactionType;

  constructor({ticker, transactionDate, transactionDateString,quantity, price, type}: TransactionsProps) {
    this.ticker = ticker;
    this.transactionDate = transactionDate;
    this.transactionDateString = transactionDateString;
    this.quantity = quantity;
    this.price = price;
    this.type = type;
  }
}