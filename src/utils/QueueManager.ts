import { randomUUID } from 'crypto'
import fs from 'fs'
import { ConnectionStates } from 'mongoose'
import * as schedule from 'node-schedule'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

import { StockProps } from '../types/stock.types'
import { Task, TaskInput } from '../types/Task.type'
import { StockDataBase } from '../useCases/stockDataBase'
import Database from './JsonDatabase'

const scheduleList = schedule.scheduledJobs

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class QueueManager extends Database<Task> {
  private static instance: QueueManager
  private queueList: Task[]
  private listeners: Array<(task: Task) => void>
  private taskHandlers: Record<string, (task: Task) => void>

  private constructor() {
    super('./json/queue.json')
    this.queueList = this.get()
    this.listeners = []
    this.taskHandlers = {}
  }

  // Método para registrar logs
  public log(message: string) {
    const logMessage = `${new Date().toISOString()} - ${message}\n`
    fs.appendFileSync(
      path.join(__dirname, '..', '..', 'json', 'queue.log'),
      logMessage,
    )
  }

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager()
    }
    return QueueManager.instance
  }

  private generateExtraTime() {
    return Math.floor(30 + (Math.random() * (10 - 2) + 2))
  }

  private validTimeConflict(time: Date): Date {
    if (
      this.get().filter(
        (item) => new Date(item.scheduledTo).getTime() === time.getTime(),
      ).length > 0
    ) {
      const extraTimeInMinutes = this.generateExtraTime()
      const newTime = new Date(time.getTime() + extraTimeInMinutes * 60000)
      return this.validTimeConflict(newTime)
    }

    time.setSeconds(0)
    time.setMilliseconds(0)

    return time
  }

  async addToQueue(task: Task | TaskInput) {
    const actualDate = new Date()
    const timeConsideredInMinutes = this.generateExtraTime()
    const scheduledDate = new Date(
      actualDate.getTime() + timeConsideredInMinutes * 60000,
    )

    const scheduledTo = task.scheduledTo
      ? task.scheduledTo
      : this.validTimeConflict(scheduledDate)
    scheduledTo.setSeconds(0)
    scheduledTo.setMilliseconds(0)

    const Fulltask: Task = {
      ...task,
      id: randomUUID(),
      scheduledTo,
      timeConsidered: timeConsideredInMinutes,
      scheduledIn: actualDate,
      finished: false,
    }

    await this.add(Fulltask, true)
    this.triggerListeners(Fulltask)
    await this.scheduleTaskExecution(Fulltask)

    // Log a tarefa adicionada
    this.log(
      `Tarefa adicionada: ${Fulltask.id}, Tipo: ${Fulltask.type}, Programada para: ${Fulltask.scheduledTo}, Data: ${Fulltask.data}`,
    )
  }

  // Método para registrar listeners
  onTaskAdded(listener: (task: Task) => void) {
    this.listeners.push(listener)
  }

  // Método para acionar os listeners
  private triggerListeners(task: Task) {
    for (const listener of this.listeners) {
      listener(task)
    }
  }

  // Método para registrar manipuladores de tarefas
  registerTaskHandler(type: string, handler: (task: Task) => void) {
    this.taskHandlers[type] = handler
  }

  // Método para agendar a execução da tarefa
  private async scheduleTaskExecution(task: Task) {
    const jobName = task.id
    const delay = task.scheduledTo.getTime() - Date.now()

    if (schedule.scheduledJobs[jobName]) {
      schedule.scheduledJobs[jobName].cancel()
    }

    const scheduledJob = schedule.scheduleJob(jobName, task.scheduledTo, () => {
      this.executeTaskHandler(task)
      this.finalizeTask(task.id)
      scheduledJob.cancel()
    })
  }

  // Método para executar o manipulador da tarefa
  private async executeTaskHandler(task: Task) {
    const handler = this.taskHandlers[task.type]
    if (handler) {
      this.log(`Iniciando execução da tarefa: ${task.id}, Tipo: ${task.type}`)
      await handler(task)
    } else {
      this.log(
        `Nenhum manipulador registrado para o tipo de tarefa: ${task.type}`,
      )
    }
  }

  private finalizeTask(taskId: string) {
    const task = this.queueList.find((t) => t.id === taskId)
    if (task) {
      task.finished = true
      this.log(`Tarefa ${taskId} finalizada.`)
      this.commit()
    }
  }
}

export const queueManager = QueueManager.getInstance()

export const startDatabaseQueue = async () => {
  const { getAll } = await StockDataBase.startDatabase()
  const allStocks: StockProps[] = await getAll()
  const tickers = allStocks.map((item) => item.ticker)

  for (const ticker of tickers) {
    await queueManager.addToQueue({
      type: 'updateStock',
      data: ticker,
    })
  }
}
