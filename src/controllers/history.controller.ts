// import { RequestHandler } from 'express';
// import axios from 'axios';
// import { ResponseProps } from '../types/responses.type';
// import { History } from '../Entities/History';
// import { TransactionsProps } from '../types/transaction.type';
// import { errorResponse, response } from '../utils/Responses';
// import { HistoryProps, SimplifiedDataHistory } from '../types/History.type';

// TODO - Refazer levando em conta que deve receber uma simulação é não um histórico
// ! Temporaly Disable using transactions
// const getHistory: RequestHandler = async (req, res, next) => {
//   try {
//     const token: string = req.body.token;
//     const responseData = await axios.post(
//       'http://localhost:3004/transactions',
//       {
//         authorization: process.env.SECRET_TOKEN,
//         token,
//       }
//     )

//     const data: ResponseProps<TransactionsProps[]> = responseData.data;
//     if(!data.data) throw new Error("Invalid Token");
//     const transactionsDB = data.data;
//     const history: HistoryProps = await History.instanceHistory(transactionsDB);
//     const { historyData, chart, transactions,...historyCleaned } = history;

//     const filteredHistoryData = Object.fromEntries(
//       Object.entries(historyData).map(([date, data]) => [
//         date,
//         { chart: historyData[date].chart, dividends: historyData[date].dividends}
//       ])
//     );
//     return response(res, { status: 200, data: { chart, historyData: filteredHistoryData, transactions }});
//   } catch (error: any) {
//     console.log(error)
//     return errorResponse(res, error);
//   }
// };

// export const getPortifolio: RequestHandler = async (req, res, next) => {
//   try {
//     const token: string = req.body.token;

//     const responseData = await axios.post(
//       'http://localhost:3004/transactions',
//       {
//         authorization: process.env.SECRET_TOKEN,
//         token,
//       }
//     )

//     const data: ResponseProps<TransactionsProps[]> = responseData.data;
//     const history = await History.instanceHistory(data.data || []);
//     return response(res, { status: 200, data: history.chart });
//   } catch (error: any) {
//     console.log(error)
//     return errorResponse(res, error);
//   }
// };

// export { getHistory };
