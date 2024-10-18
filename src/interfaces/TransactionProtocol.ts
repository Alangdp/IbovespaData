import { randomUUID } from 'crypto';
import { TransactionsProps } from '../types/transaction.type';
import { DateFormatter } from '../utils/DateFormater.js'

export abstract class Transaction implements TransactionsProps {
  id: number;
  ticker: string;
  totalValue: number;
  createdAt: string;
  updatedAt: string;
  userId: number;
  quantity: number;
  type: string;
  price: number;
  transactionDate: Date;
  trasactionDateString: string;
  description?: string | undefined;

  constructor({
    price,
    quantity,
    transactionDate,
    type,
    userId,
    ticker,
  }: TransactionsProps) {
    this.ticker = ticker;
    this.price = price;
    this.quantity = quantity;
    this.transactionDate = transactionDate;
    this.trasactionDateString = DateFormatter.dateToString(transactionDate);
    this.type = type;
    this.userId = userId;
    // RANDOM NUMBER
    this.id = Math.floor(Math.random() * 1000);
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.totalValue = this.quantity * this.price;
    this.makeDescription();
  }

  makeDescription() {
    this.description = `
      Está uma transaçao do tipo ${this.type} \n
      Envoldendo ${this.quantity} de itens no valor total de ${this.quantity * this.price} \n
    `;
  }

  getType() {
    return this.type;
  }

  getTransactionDate() {
    return this.transactionDate;
  }

  getTransactionDateString() {
    return this.trasactionDateString;
  }
}
