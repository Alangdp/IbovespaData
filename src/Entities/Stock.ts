import { StockProtocol } from '../interfaces/StockProtocol.type.js';
import { PassiveChartReturn } from '../types/PassiveChart.type.js';
import { LastDividendPayment } from '../types/dividends.type.js';
import { FinancialIndicators } from '../types/indicators.type.js';
import {
  NetLiquid,
  StockProps,
} from '../types/stock.types.js';
import { Variable } from './Variable.js';

export class Stock extends Variable implements StockProtocol {
  calculateRentability(actualPrice: number, referencePrice: number): number {
    return ((actualPrice - referencePrice) / referencePrice) * 100;
  }
  // FIXME - Soluções temporárias

  public lastDividendsAverage?: number;
  public dividendYield: number;
  public grossDebt: number;
  public patrimony: number;
  public lpa: number;
  public p_l: number;
  public freeFloat: number;

  public lastDividendsYieldYear: number[];
  public lastDividendsValueYear: number[];
  public lastDividendsValue: LastDividendPayment[];

  public payout: number;
  public actualDividendYield: number;
  public netLiquid: NetLiquid[];
  public passiveChart: PassiveChartReturn[];

  public segment: string

  public indicators: FinancialIndicators;

  constructor(props: StockProps) {
    super(
      {
        ticker: props.ticker,
        name: props.name,
        activeValue: props.activeValue,
        shareQuantity: props.shareQuantity,
        actualPrice: props.actualPrice,
        priceHistory: props.priceHistory
      }
    );

    this.freeFloat = props.freeFloat;
    this.lpa = props.lpa;
    this.p_l = props.p_l;
    this.segment = props.segment;
    this.indicators = props.indicators;
    this.dividendYield = props.dividendYield;
    this.grossDebt = props.grossDebt;
    this.patrimony = props.patrimony;
    this.payout = props.payout;
    this.actualDividendYield = props.actualDividendYield;

    this.lastDividendsYieldYear = props.lastDividendsYieldYear;
    this.lastDividendsValueYear = props.lastDividendsValueYear;
    this.lastDividendsValue = props.lastDividendsValue;

    this.netLiquid = props.netLiquid;
    this.passiveChart = props.passiveChart;
  }
}
