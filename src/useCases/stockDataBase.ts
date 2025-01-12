import stockModel from '../database/mongodb/models/Stock.model.js'
import env from '../env.js'
import { StockProtocol } from '../interfaces/StockProtocol.type.js'
import { InstanceStock } from './instanceStock.js'

const HOUR_IN_MILISECONDS = 3600000

export class StockDataBase {
  private static toleranceTime: number =
    env.TOLERANCE_TIME_HOURS * HOUR_IN_MILISECONDS

  static async startDatabase() {
    const activeModel = await stockModel

    async function createStock(ticker: string) {
      const stock = await InstanceStock.execute(ticker)
      return activeModel.create(stock)
    }

    async function findStock(ticker: string) {
      return activeModel.findOne({ ticker })
    }

    async function getAll() {
      return activeModel.find({})
    }

    async function findStockBySegment(segment: string) {
      return activeModel.find({ segment }, { _id: false })
    }

    async function deleteStock(stock: StockProtocol) {
      await activeModel.deleteOne(stock)
    }

    async function existsStock(ticker: string) {
      const stock = await findStock(ticker)
      if (!stock) return null
      return stock
    }

    function validTime(time: number) {
      const HOUR_IN_MILLISECONDS = 3600000 // 1 hora em milissegundos
      return new Date().getTime() - time <= HOUR_IN_MILLISECONDS
    }

    async function getStock(ticker: string) {
      const stock = await existsStock(ticker)
      if (!stock) return createStock(ticker)
      const time = stock.get('createdAt') as Date
      const isValid = validTime(time.getTime())
      if (!isValid) {
        await activeModel.deleteMany({ ticker })
        return createStock(ticker)
      }
      return stock
    }

    async function updateStock(ticker: string) {
      await activeModel.deleteMany({ ticker })
      return createStock(ticker)
    }

    async function getStockWithoutTime(ticker: string) {
      const stock = await activeModel.findOne({ ticker })
      return stock
    }

    return {
      createStock,
      findStock,
      updateStock,
      deleteStock,
      existsStock,
      getStock,
      getStockWithoutTime,
      findStockBySegment,
      getAll,
    }
  }
}
