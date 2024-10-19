import { TaskInput } from './types/Task.type';
import { StockDataBase } from './useCases/stockDataBase';
import { queueManager, startDatabaseQueue } from './utils/QueueManager';
export const start = async () => {
  queueManager.registerTaskHandler('updateRanking', (task) => {
    const newTask: TaskInput = {
      ...task,
    };
    queueManager.addToQueue(newTask);
  });

  queueManager.onTaskAdded((task) => {
    queueManager.log(
      `Tarefa adicionada: ${task.id}, Tipo: ${task.type}, Programada para: ${task.scheduledTo}`
    );
  });

  queueManager.registerTaskHandler('updateStock', async (task) => {
    const { updateStock } = await StockDataBase.startDatabase();
    queueManager.log(`Executando atualização de stock para: ${task.data}`);

    const stockData = await updateStock(task.data);

    const newTask: TaskInput = {
      ...task,
    };
    await queueManager.addToQueue(newTask);
  });

  await startDatabaseQueue();
};
