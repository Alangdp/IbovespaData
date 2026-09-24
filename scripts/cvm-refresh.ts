// Atualiza na hora a base de informes da CVM no Redis, sem esperar o job
// diário. Use --force para baixar mesmo sem mudança nos arquivos.
//   bun scripts/cvm-refresh.ts [--force]
import { Redis } from '../src/global/Redis'
import { CvmDataBase } from '../src/useCases/cvmDataBase'

// Efetua a atualização e mostra o resultado
const force = process.argv.includes('--force')
const result = await new CvmDataBase().refresh(force)
console.log(
  result.atualizado
    ? `base atualizada: ${result.fundos} fundos`
    : 'sem novidades na CVM (use --force para baixar mesmo assim)',
)

await Redis.getInstance().quit()
process.exit(0)
