// Enfileira todos os tickers da B3 (fundamentus) para o worker atualizar o
// cache no Redis. Tickers listados em json/invalidTickers.json (opcional,
// ignorado pelo git) são pulados.
//   bun scripts/start-queue.ts
import { join } from 'node:path'

import { STOCK_JOB, stockQueue } from '../src/global/Queue'
import { fetchAllTickers } from '../src/sources/fundamentus'

async function readInvalidTickers(): Promise<string[]> {
  const file = Bun.file(
    join(import.meta.dir, '..', 'json', 'invalidTickers.json'),
  )
  if (!(await file.exists())) return []
  return file.json()
}

const invalidTickers = new Set(await readInvalidTickers())
const allTickers = await fetchAllTickers()
const validTickers = allTickers.filter((ticker) => !invalidTickers.has(ticker))

await stockQueue.addBulk(
  validTickers.map((ticker) => ({ name: STOCK_JOB, data: { ticker } })),
)

console.log(`${validTickers.length} tickers enfileirados`)
await stockQueue.close()
