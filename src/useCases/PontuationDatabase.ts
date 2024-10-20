import { configDotenv } from 'dotenv';
import { Pontuation } from '../Entities/Pontuation.js';
import { pontuationModel } from '../database/mongodb/models/Pontuation.model.js';
import { InstanceStock } from './instanceStock.js';
import { Bazin } from '../Entities/Bazin.js';
import { Granham } from '../Entities/Graham.js';
import { prop } from 'cheerio/lib/api/attributes.js';

configDotenv();

const HOUR_IN_MILISECONDS = 3600000;

interface DatabaseProps {
  ticker?: string;
  type: 'BAZIN' | 'GRAHAM';
}

export class PontuationDataBase {
  private static toleranceTime: number = process.env
    .TOLERANCE_TIME_HOURS_RANKING as unknown as number;

  static async create(props: DatabaseProps) {
    if (!props.ticker)
      throw new Error('To register pontuation is necessari ticker!');
    const model = await pontuationModel;
    const stock = await InstanceStock.execute(props.ticker);
    let pontuation: Pontuation | undefined = undefined;

    if (props.type === 'BAZIN') {
      pontuation = new Bazin(stock).makePoints(stock);
      await model.create(pontuation);
      return pontuation;
    }
    if (props.type === 'GRAHAM') {
      pontuation = await new Granham(stock).makePoints(stock);
      await model.create(pontuation);
      return pontuation;
    }
    throw new Error('Invalid Type');
  }

  static async find(props: DatabaseProps) {
    const point = (await pontuationModel).findOne({
      subId: props.type,
      id: props.ticker,
    });
    return point;
  }

  static async update(pontuation: Pontuation) {
    await (await pontuationModel).updateOne(pontuation);
  }

  static async delete(pontuation: Pontuation) {
    await (await pontuationModel).deleteOne(pontuation);
  }

  static async exists(props: DatabaseProps) {
    const points = await PontuationDataBase.find(props);
    if (!points) return null;
    return points;
  }

  static validTime(time: number) {
    const milliseconds = new Date().getTime() - (time ?? 0);
    return (
      milliseconds / HOUR_IN_MILISECONDS < PontuationDataBase.toleranceTime
    );
  }

  static async get(props: DatabaseProps) {
    const points = await PontuationDataBase.find(props);
    if (!points) return PontuationDataBase.create(props);

    const time = points.get('createdAt') as Date;
    const valid = PontuationDataBase.validTime(time.getTime());
    if (!valid) {
      await points.deleteOne({ ...props });
      return await PontuationDataBase.create(props);
    }
    return points;
  }

  static async getAll(subId: 'BAZIN' | 'GRAHAM') {
    const model = await pontuationModel;
    const points = await model.find({ subId });
    return points;
  }
}
