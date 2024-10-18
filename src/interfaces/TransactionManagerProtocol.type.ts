import { Transaction } from 'sequelize';

export interface TransactionManagerProtocol {
  addTransaction(transaction: Transaction): void;
  getTransactionByCode(code: number): Transaction | undefined;
  getTransactionByNumber(number: string): Transaction | undefined;
}
