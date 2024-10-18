import { Schema } from 'mongoose';
import { InfoData, PontuationProps, PontuationRule } from '../../../types/Pontuation.type';
import { MongooConnection } from '../../index.js';

interface PontuationDocument extends PontuationProps {
  defaultIfTrue: number;
  defaultIfFalse: number;
  id: string;
  subId: string;
  totalEvaluate: PontuationRule[];
  infoData: InfoData;
  totalPoints: number;
  createdAt: Date;
}

const pontuationSchema = new Schema<PontuationDocument>({
  defaultIfTrue: { type: Number, required: true },
  defaultIfFalse: { type: Number, required: true },
  id: { type: String, required: true},
  subId: { type: String, required: true},
  totalPoints: {type: Number, required: true},
  infoData: {
    actualPrice: { type: Number, required: true },
    dy: { type: Number, required: true },
    maxPrice: { type: Number, required: true }
  },
  totalEvaluate: [
    {
      ruleName: { type: String, required: true },
      rule: { type: Boolean, required: true },
      ifTrue: { type: Number, required: false },
      ifFalse: { type: Number, required: false },
      scored: { type: Boolean, default: false }
    }
  ],
  createdAt: {type: Date, default: new Date()}
});

async function makeConnection() {
  const mongoose = await MongooConnection.makeConnection() 
  return mongoose.model<PontuationDocument>('pontuations', pontuationSchema)
}

const pontuationModel = makeConnection()

export { pontuationModel };
