// TODO ALTERAR O SITEMA DE CODIGOS USAR SOMENTE OS NUMEROS

import { BuyTransactionProcol } from '../interfaces/TransactionBuyProtocol.type';
import { Transaction } from '../interfaces/TransactionProtocol.js';
import { TransactionsProps } from '../types/transaction.type';
import { TransactionHistory } from '../interfaces/Transaction';

export default class BuyTransaction
  extends Transaction
  implements BuyTransactionProcol, TransactionHistory
{
  ticker: string;

  private constructor(
    requirements: TransactionsProps,
    buyData: {
      ticker: string;
    }
  ) {
    super(requirements);

    this.ticker = buyData.ticker;
  }

  static create(
    requirements: TransactionsProps ,
    sellData: {
      ticker: string;
    }
  ) {
    return new BuyTransaction(requirements, sellData);
  }

  getQuantity(): number {
    return this.quantity;
  }

  getPrice(): number {
    return this.price;
  }

  getTicker(): string {
    return this.ticker;
  }
}

export { BuyTransaction };
