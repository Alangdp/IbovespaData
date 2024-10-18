// TODO ALTERAR O SITEMA DE CODIGOS USAR SOMENTE OS NUMEROS

import { Transaction } from '../interfaces/TransactionProtocol';
import { SellTransactionProcol } from '../interfaces/TransactionSellProtocol.type';
import { TransactionsProps } from '../types/transaction.type';
import { TransactionHistory } from '../interfaces/Transaction';

export default class SellTransaction
  extends Transaction
  implements SellTransactionProcol, TransactionHistory
{
  ticker: string;

  private constructor(
    requirements: TransactionsProps,
    sellData: {
      ticker: string;
    }
  ) {
    super(requirements);

    this.ticker = sellData.ticker;
  }

  create(
    requirements: TransactionsProps,
    sellData: {
      ticker: string;
    }
  ) {
    return new SellTransaction(requirements, sellData);
  }

  getTicker(): string {
    return this.ticker;
  }

  getQuantity(): number {
    return this.quantity;
  }

  getPrice(): number {
    return this.price;
  }
}

export { SellTransaction };
