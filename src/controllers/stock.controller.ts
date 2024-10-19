import { RequestHandler } from 'express';
import { StockProps } from '../types/stock.types.js';
import { addError, errorResponse, response } from '../utils/Responses.js';
import { StockDataBase } from '../useCases/stockDataBase.js';

import Utilities from '../utils/Utilities.js';
import { Bazin } from '../Entities/Bazin.js';
import { Granham } from '../Entities/Graham.js';

const toChartWithoutDate = (data: any[]) => {
  const toReturn: ChartsDefault = {};

  const date = new Date();
  for (let i = 0; i < data.length; i++) {
    toReturn[`${date.getFullYear() - i}`] = {
      value: typeof data[0] === 'number' ? data[i].toFixed(2) : data[i],
      label: `${date.getFullYear() - i}`,
    };
  }

  return toReturn;
};

export const indexFullStock: RequestHandler = async (req, res, next) => {
  const { getStockWithoutTime, getStock } = await StockDataBase.startDatabase();

  try {
    const ticker: string = req.body.ticker;
    const stock: StockProps = (await getStock(ticker)).toObject();

    const { __v, createdAt, updatedAt, ...cleanStock } =
      Utilities.removeKeyRecursively(stock, '_id');

    return response(res, { status: 200, data: cleanStock });
  } catch (error: any) {
    try {
      const stock = await getStockWithoutTime(req.body.ticker);
      const { __v, createdAt, updatedAt, ...cleanStock } =
        Utilities.removeKeyRecursively(stock, '_id');
      return response(res, { status: 200, data: cleanStock });
    } catch (error) {
      return errorResponse(res, error);
    }
  }
};

export const index: RequestHandler = async (req, res, next) => {
  const { getStockWithoutTime, getStock } = await StockDataBase.startDatabase();

  try {
    const ticker: string = req.params.ticker;
    const stock: StockProps = (await getStock(ticker)).toObject();

    return response(res, {
      status: 200,
      data: stock,
    });
  } catch (error: any) {
    const stock = await getStockWithoutTime(req.body.ticker);
    console.log(error.message);
    if (error.message && error.message.includes('404'))
      return response(res, {
        status: 400,
        errors: [addError('Invalid Ticker', null)],
      });
    if (!stock) return errorResponse(res, error);
    return response(res, { status: 200, data: stock });
  }
};

export const indexPrice: RequestHandler = async (req, res, next) => {
  const { getStockWithoutTime, getStock } = await StockDataBase.startDatabase();

  try {
    const ticker: string = req.params.ticker;
    const stockRaw: StockProps = (await getStock(ticker)).toObject();

    return response(res, {
      status: 200,
      data: stockRaw,
    });
  } catch (error: any) {
    const stock = await getStockWithoutTime(req.body.ticker);

    if (!stock) return errorResponse(res, error);
    return response(res, { status: 200, data: stock });
  }
};

export const indexIndicators: RequestHandler = async (req, res, next) => {
  const { getStockWithoutTime, getStock } = await StockDataBase.startDatabase();

  try {
    const ticker: string = req.params.ticker;
    const stockRaw: StockProps = (await getStock(ticker)).toObject();

    return response(res, {
      status: 200,
      data: stockRaw.indicators,
    });
  } catch (error: any) {
    const stock = await getStockWithoutTime(req.body.ticker);
    if (!stock) return errorResponse(res, error);
    return response(res, { status: 200, data: stock });
  }
};

export const indexBySegment: RequestHandler = async (req, res, next) => {
  const { findStockBySegment } = await StockDataBase.startDatabase();

  try {
    const segment: string = req.params.segment;
    const stockRaw = await findStockBySegment(segment);

    return response(res, {
      status: 200,
      data: stockRaw,
    });
  } catch (error: any) {
    return errorResponse(res, error);
  }
};

export const indexBazin: RequestHandler = async (req, res, next) => {
  const { getStockWithoutTime, getStock } = await StockDataBase.startDatabase();

  try {
    const ticker: string = req.params.ticker;
    const stock: StockProps = (await getStock(ticker)).toObject();

    const { __v, createdAt, updatedAt, ...cleanStock } =
      Utilities.removeKeyRecursively(stock, '_id');

    const bazin = new Bazin(cleanStock).makePoints(cleanStock);

    return response(res, { status: 200, data: bazin });
  } catch (error: any) {
    return errorResponse(res, error);
  }
};

export const indexGraham: RequestHandler = async (req, res, next) => {
  const { getStockWithoutTime, getStock } = await StockDataBase.startDatabase();

  try {
    const ticker: string = req.params.ticker;
    const stock: StockProps = (await getStock(ticker)).toObject();

    const { __v, createdAt, updatedAt, ...cleanStock } =
      Utilities.removeKeyRecursively(stock, '_id');
    const graham = new Granham(cleanStock);
    const grahamPoints = await graham.makePoints(cleanStock);

    console.log(graham);

    return response(res, { status: 200, data: grahamPoints });
  } catch (error: any) {
    return errorResponse(res, error);
  }
};
