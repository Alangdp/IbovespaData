import { Backtest } from '../core/Backtest.js'
import type { Scorer } from '../core/Scorer.js'
import type {
  FiiHistoricalProvider,
  FiiSnapshot,
} from './FiiHistoricalProvider.js'
import { FII_SCORES, FiiScorer } from './FiiScorer.js'

/** Simulação histórica de aportes em FIIs seguindo o score de FII */
export class FiiBacktest extends Backtest<FiiSnapshot> {
  constructor(private readonly fiiProvider: FiiHistoricalProvider) {
    super(fiiProvider)
  }

  versoesScore(): string[] {
    return Object.keys(FII_SCORES)
  }

  criarScorer(versao: string): Scorer<FiiSnapshot> {
    return FiiScorer.versao(versao)
  }

  override versaoDados(): string {
    return this.fiiProvider.versaoDados()
  }
}
