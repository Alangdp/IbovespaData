import { Schema } from 'mongoose';
import {
  NetLiquid,
  PriceHistory,
  StockProps,
} from '../../../types/stock.types';
import { LastDividendPayment } from '../../../types/dividends.type';
import { FinancialIndicators } from '../../../types/indicators.type';
import { PassiveChartReturn } from '../../../types/PassiveChart.type';
import { MongooConnection } from '../../index.js';

const priceHistorySchema = new Schema<PriceHistory>({
  date: { type: String, required: false },
  price: { type: Number, default: 0, required: false },
});

const lastDividendsValueSchema = new Schema<LastDividendPayment>({
  ticker: { type: String, required: false },
  dataCom: { type: String, required: false },
  dataEx: { type: String, required: false },
  dividendType: { type: String, required: false },
  dividendTypeName: { type: String, required: false },
  value: { type: Number, default: 0, required: false },
});

const oldIndicatorSchema = new Schema({
  date: { type: Number, required: true },
  value: { type: Number, required: true },
});

const financialDataSchema = new Schema(
  {
    actual: { type: Number, required: false },
    avg: { type: Number, required: false },
    olds: [oldIndicatorSchema],
  },
  { _id: false }
);

const indicatorsDataSchema = new Schema({
  dy: {
    type: financialDataSchema,
    _id: false,
  },
  p_l: {
    type: financialDataSchema,
    _id: false,
  },
  p_vp: {
    type: financialDataSchema,
    _id: false,
  },
  p_ebita: {
    type: financialDataSchema,
    _id: false,
  },
  p_ebit: {
    type: financialDataSchema,
    _id: false,
  },
  p_sr: {
    type: financialDataSchema,
    _id: false,
  },
  p_ativo: {
    type: financialDataSchema,
    _id: false,
  },
  p_capitlgiro: {
    type: financialDataSchema,
    _id: false,
  },
  p_ativocirculante: {
    type: financialDataSchema,
    _id: false,
  },
  ev_ebitda: {
    type: financialDataSchema,
    _id: false,
  },
  ev_ebit: {
    type: financialDataSchema,
    _id: false,
  },
  lpa: {
    type: financialDataSchema,
    _id: false,
  },
  vpa: {
    type: financialDataSchema,
    _id: false,
  },
  peg_Ratio: {
    type: financialDataSchema,
    _id: false,
  },
  dividaliquida_patrimonioliquido: {
    type: financialDataSchema,
    _id: false,
  },
  dividaliquida_ebitda: {
    type: financialDataSchema,
    _id: false,
  },
  dividaliquida_ebit: {
    type: financialDataSchema,
    _id: false,
  },
  patrimonio_ativo: {
    type: financialDataSchema,
    _id: false,
  },
  passivo_ativo: {
    type: financialDataSchema,
    _id: false,
  },
  liquidezcorrente: {
    type: financialDataSchema,
    _id: false,
  },
  margembruta: {
    type: financialDataSchema,
    _id: false,
  },
  margemebitda: {
    type: financialDataSchema,
    _id: false,
  },
  margemebit: {
    type: financialDataSchema,
    _id: false,
  },
  margemliquida: {
    type: financialDataSchema,
    _id: false,
  },
  roe: {
    type: financialDataSchema,
    _id: false,
  },
  roa: {
    type: financialDataSchema,
    _id: false,
  },
  roic: {
    type: financialDataSchema,
    _id: false,
  },
  giro_ativos: {
    type: financialDataSchema,
    _id: false,
  },
  receitas_cagr5: {
    type: financialDataSchema,
    _id: false,
  },
});

const netLiquidSchema = new Schema<NetLiquid>({
  year: { type: String, required: false },
  value: { type: Number, default: 0, required: false },
});

const passiveChartSchema = new Schema<PassiveChartReturn>({
  year: { type: Number, default: 0, required: false },
  totalAssets: { type: Number, default: 0, required: false },
  totalLiabilities: { type: Number, default: 0, required: false },
  currentAssets: { type: Number, default: 0, required: false },
  nonCurrentAssets: { type: Number, default: 0, required: false },
  currentLiabilities: { type: Number, default: 0, required: false },
  nonCurrentLiabilities: { type: Number, default: 0, required: false },
  shareholdersEquity: { type: Number, default: 0, required: false },
});

const stockSchema = new Schema<StockProps>(
  {
    ticker: {
      _id: false,
      unique: true,
      required: false,
      type: String,
    },

    lpa: {
      _id: false,
      required: false,
      type: Number,
    },

    p_l: {
      _id: false,
      required: false,
      type: Number,
    },

    name: {
      _id: false,
      required: false,
      type: String,
    },

    activeValue: {
      _id: false,
      required: false,
      type: Number,
    },

    shareQuantity: {
      _id: false,
      required: false,
      type: Number,
    },

    actualPrice: {
      _id: false,
      required: false,
      type: Number,
    },

    priceHistory: {
      _id: false,
      required: false,
      type: [priceHistorySchema],
    },

    dividendYield: {
      _id: false,
      required: false,
      type: Number,
    },

    grossDebt: {
      _id: false,
      required: false,
      type: Number,
    },

    patrimony: {
      _id: false,
      required: false,
      type: Number,
    },

    payout: {
      _id: false,
      required: false,
      type: Number,
    },

    actualDividendYield: {
      _id: false,
      required: false,
      type: Number,
    },

    lastDividendsYieldYear: {
      _id: false,
      required: false,
      type: [Number],
    },

    lastDividendsValueYear: {
      _id: false,
      required: false,
      type: [Number],
    },

    lastDividendsValue: {
      _id: false,
      required: false,
      type: [lastDividendsValueSchema],
    },

    indicators: {
      _id: false,
      required: false,
      type: indicatorsDataSchema,
    },

    netLiquid: {
      _id: false,
      required: false,
      type: [netLiquidSchema],
    },

    passiveChart: {
      _id: false,
      required: false,
      type: [passiveChartSchema],
    },

    segment: {
      _id: false,
      required: true,
      type: String,
    },
  },
  { timestamps: true }
);

async function makeModel() {
  const mongoose = await MongooConnection.makeConnection();
  return mongoose.model<StockProps>('Stock', stockSchema);
}

const stockModel = makeModel();

export default stockModel;
