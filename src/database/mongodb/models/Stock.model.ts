import { Schema } from 'mongoose';
import { NetLiquid, PriceHistory, StockProps } from '../../../types/stock.types'
import { LastDividendPayment } from '../../../types/dividends.type';
import { FinancialIndicators } from '../../../types/indicators.type';
import { PassiveChartReturn } from '../../../types/PassiveChart.type';
import { MongooConnection } from '../../index.js'

const priceHistorySchema = new Schema<PriceHistory>({
  date: { type: String, required: false },
  price: { type: Number, default: 0, required: false }
});

const lastDividendsValueSchema = new Schema<LastDividendPayment>({
  ticker: { type: String, required: false },
  dataCom: { type: String, required: false },  
  dataEx: { type: String, required: false },
  dividendType: { type: String, required: false },
  dividendTypeName: { type: String, required: false },
  value: { type: Number, default: 0, required: false }
})

const oldIndicatorSchema = new Schema({
  date: { type: Number, required: true },
  value: { type: Number, required: true }
});

const financialDataSchema = new Schema({
  actual: { type: Number, required: false },
  avg: { type: Number, required: false },
  olds: [oldIndicatorSchema] 
});

const indicatorsDataSchema = new Schema({
  dy: financialDataSchema,
  p_l: financialDataSchema,
  p_vp: financialDataSchema,
  p_ebita: financialDataSchema,
  p_ebit: financialDataSchema,
  p_sr: financialDataSchema,
  p_ativo: financialDataSchema,
  p_capitlgiro: financialDataSchema,
  p_ativocirculante: financialDataSchema,
  ev_ebitda: financialDataSchema,
  ev_ebit: financialDataSchema,
  lpa: financialDataSchema,
  vpa: financialDataSchema,
  peg_Ratio: financialDataSchema,
  dividaliquida_patrimonioliquido: financialDataSchema,
  dividaliquida_ebitda: financialDataSchema,
  dividaliquida_ebit: financialDataSchema,
  patrimonio_ativo: financialDataSchema,
  passivo_ativo: financialDataSchema,
  liquidezcorrente: financialDataSchema,
  margembruta: financialDataSchema,
  margemebitda: financialDataSchema,
  margemebit: financialDataSchema,
  margemliquida: financialDataSchema,
  roe: financialDataSchema,
  roa: financialDataSchema,
  roic: financialDataSchema,
  giro_ativos: financialDataSchema,
  receitas_cagr5: financialDataSchema
});

const netLiquidSchema = new Schema<NetLiquid>({
  year: { type: String, required: false },
  value: { type: Number, default: 0, required: false }
})

const passiveChartSchema = new Schema<PassiveChartReturn>({
  year: { type: Number, default: 0, required: false },
  totalAssets: { type: Number, default: 0, required: false },
  totalLiabilities: { type: Number, default: 0, required: false },
  currentAssets: { type: Number, default: 0, required: false },
  nonCurrentAssets: { type: Number, default: 0, required: false },
  currentLiabilities: { type: Number, default: 0, required: false },
  nonCurrentLiabilities: { type: Number, default: 0, required: false },
  shareholdersEquity: { type: Number, default: 0, required: false }
})

const stockSchema = new Schema<StockProps>({
  ticker: {
    unique: true,
    required: false,
    type: String
  },

  lpa: {
    required: false,
    type: Number
  },

  p_l: {
    required: false,
    type: Number
  },

  name: {
    required: false,
    type: String
  },

  activeValue: {
    required: false,
    type: Number
  },

  shareQuantity: {
    required: false,
    type: Number
  },

  actualPrice: {
    required: false,
    type: Number
  },

  priceHistory: {
    required: false,
    type: [priceHistorySchema]
  },
  
  dividendYield: {
    required: false,
    type: Number
  },

  grossDebt: {
    required: false,
    type: Number
  },

  patrimony: {
    required: false,
    type: Number
  },

  payout: {
    required: false,
    type: Number
  },

  actualDividendYield: {
    required: false,
    type: Number
  },

  lastDividendsYieldYear: {
    required: false,
    type: [Number]
  },

  lastDividendsValueYear: {
    required: false,
    type: [Number]
  },

  lastDividendsValue: {
    required: false,
    type: [lastDividendsValueSchema]
  },

  indicators: {
    required: false,
    type: indicatorsDataSchema
  },

  netLiquid: {
    required: false,
    type: [netLiquidSchema]
  },

  passiveChart: {
    required: false,
    type: [passiveChartSchema]
  },

  segment: {
    required: true,
    type: String
  }
}, { timestamps: true })


async function makeModel() {
  const mongoose = await MongooConnection.makeConnection()
  return mongoose.model<StockProps>('Stock', stockSchema)
}

const stockModel = makeModel()

export default stockModel
