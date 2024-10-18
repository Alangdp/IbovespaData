import { RequestHandler } from 'express';
import { errorResponse, response } from '../utils/Responses.js';
import { PontuationDataBase } from '../useCases/PontuationDatabase.js';
import { PontuationProps } from '../types/Pontuation.type.js';

const getRank: RequestHandler = async (req, res, next) => {
  try {
    const data = await PontuationDataBase.getAll('BAZIN');
    const formattedData: PontuationProps[] = data;
    const sortedData = formattedData.sort(
      (a, b) => b.totalPoints - a.totalPoints
    );
    return response(res, { status: 200, data: sortedData });
  } catch (error: any) {
    console.log(error);
    return errorResponse(res, error);
  }
};

export { getRank };
