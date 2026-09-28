import { addDays, lastIndexAtOrBefore } from './dates.js'
import type { EventoAtivo, IsoDate } from './types.js'

/** Cotação de um pregão */
export interface PrecoDia {
  data: IsoDate
  /** Fechamento sem ajuste (R$) */
  fechamento: number
  /** Volume financeiro (R$) */
  volume: number
}

/** Provento por cota, na base de cotas da data-com (sem ajuste) */
export interface Provento {
  ativoId: string
  dataCom: IsoDate
  dataPagamento: IsoDate
  valor: number
  /** Tipo (Rendimento, Amortização...); ausente = rendimento */
  tipo?: string
  /** De onde veio o valor (ex.: statusinvest, cvm_estimado) */
  fonte: string
}

/** Verifica se o provento é amortização (devolução de capital, não rendimento) */
export function ehAmortizacao(provento: Provento): boolean {
  return /amortiza/i.test(provento.tipo ?? '')
}

/** Valor de uma série macroeconômica */
export interface ValorMacro {
  /** Data de referência */
  data: IsoDate
  valor: number
  /** Data em que o valor passou a ser público */
  conhecidoEm: IsoDate
}

/** Ativo disponível na base histórica */
export interface AtivoInfo {
  /** Identificador estável do ativo (ISIN), que não muda com o ticker */
  ativoId: string
  /** Ticker mais recente */
  ticker: string
  primeiraData: IsoDate
  ultimaData: IsoDate
}

/** Campos comuns do estado de um ativo em uma data */
export interface AtivoSnapshot {
  ativoId: string
  ticker: string
  /** Data da decisão (os dados são de antes dela) */
  data: IsoDate
  /** Fechamento do último pregão antes da data */
  preco: number
  /** Volume financeiro médio diário dos últimos pregões (R$) */
  liquidezMedia: number
}

/** Pregões usados na liquidez média */
const PREGOES_LIQUIDEZ = 60

/** Pregões sem negociação para o ativo sair do universo */
export const PREGOES_SEM_NEGOCIACAO = 10

/**
 * Visão dos dados históricos como eram conhecidos em uma data
 *
 * Tudo o que ela expõe é de ANTES da data: cotações até o pregão anterior,
 * proventos com data-com anterior e eventos anteriores. É a única porta do
 * score para os dados de mercado, o que evita o look-ahead bias
 */
export class PointInTimeView {
  /** Último dia visível (véspera da decisão) */
  readonly ate: IsoDate

  constructor(
    private readonly provider: HistoricalDataProvider<AtivoSnapshot>,
    /** Data da decisão (exclusiva) */
    readonly data: IsoDate,
  ) {
    this.ate = addDays(data, -1)
  }

  /** Cotações do ativo antes da data */
  precos(ativoId: string): PrecoDia[] {
    const fim = lastIndexAtOrBefore(
      this.provider.datasPrecos(ativoId),
      this.ate,
    )
    return this.provider.precos(ativoId).slice(0, fim + 1)
  }

  /** Último fechamento antes da data; `null` se nunca negociou */
  ultimoPreco(ativoId: string): PrecoDia | null {
    return this.provider.ultimoPrecoAte(ativoId, this.ate)
  }

  /**
   * Último fechamento até `data` (inclusive), limitado à véspera da decisão
   *
   * @returns `null` se o ativo não negociou até lá
   */
  precoAte(ativoId: string, data: IsoDate): PrecoDia | null {
    return this.provider.ultimoPrecoAte(
      ativoId,
      data < this.ate ? data : this.ate,
    )
  }

  /** Proventos com data-com antes da data */
  proventos(ativoId: string): Provento[] {
    return this.provider
      .proventos(ativoId)
      .filter((provento) => provento.dataCom < this.data)
  }

  /** Eventos (desdobramentos etc.) antes da data */
  eventos(ativoId: string): EventoAtivo[] {
    return this.provider
      .eventos(ativoId)
      .filter((evento) => evento.data < this.data)
  }

  /**
   * Cotas atuais por cota de `desde` (produto dos desdobramentos depois de
   * `desde` e antes da data): um valor por cota de `desde` (provento,
   * patrimônio) é DIVIDIDO por ele para ir à base de cotas atual
   */
  fatorAjuste(ativoId: string, desde: IsoDate): number {
    return this.eventos(ativoId)
      .filter((evento) => evento.data > desde && evento.fator)
      .reduce((fator, evento) => fator * (evento.fator ?? 1), 1)
  }

  /**
   * Último valor da série macro conhecido antes da data (pela data de
   * divulgação, não pela de referência)
   *
   * @returns `null` se a série não tem valor conhecido
   */
  macro(serie: string): ValorMacro | null {
    const valores = this.provider.serieMacro(serie)
    const indice = lastIndexAtOrBefore(
      this.provider.divulgacoesMacro(serie),
      this.ate,
    )
    return indice >= 0 ? valores[indice] : null
  }

  /** CDI acumulado (fração) dos últimos `dias` corridos antes da data */
  cdiAcumulado(dias: number): number {
    return this.provider.cdiEntre(addDays(this.data, -dias), this.ate)
  }

  /** Volume financeiro médio dos últimos pregões antes da data */
  liquidezMedia(ativoId: string, pregoes = PREGOES_LIQUIDEZ): number {
    // Considera os últimos pregões do mercado, contando zero nos dias sem
    // negociação do ativo
    const calendario = this.provider.pregoes()
    const fim = lastIndexAtOrBefore(calendario, this.ate)
    // Se não há pregões antes da data
    if (fim < 0) {
      return 0
    }
    const inicio = calendario[Math.max(fim - pregoes + 1, 0)]

    // Soma o volume dos pregões do ativo entre o início da janela e a data
    const datas = this.provider.datasPrecos(ativoId)
    const precos = this.provider.precos(ativoId)
    let volume = 0
    for (
      let i = lastIndexAtOrBefore(datas, this.ate);
      i >= 0 && datas[i] >= inicio;
      i--
    ) {
      volume += precos[i].volume
    }
    return volume / Math.min(pregoes, fim + 1)
  }
}

/**
 * Fonte dos dados históricos de um tipo de ativo
 *
 * A base sabe montar a visão por data e o universo de ativos negociáveis;
 * cada tipo de ativo (FII, ação) estende a classe e monta o seu snapshot com
 * os fundamentos disponíveis naquela data
 */
export abstract class HistoricalDataProvider<TSnapshot extends AtivoSnapshot> {
  /** Tipo de ativo (fii, acao), gravado com os resultados */
  abstract readonly tipoAtivo: string

  private readonly datasCache = new Map<string, IsoDate[]>()
  private ativosCache: Map<string, AtivoInfo> | null = null
  private readonly universoCache = new Map<IsoDate, TSnapshot[]>()
  private readonly divulgacoesCache = new Map<string, IsoDate[]>()
  private cdiIndice: { datas: IsoDate[]; acumulado: number[] } | null = null

  /** Pregões da base, em ordem */
  abstract pregoes(): IsoDate[]

  /** Ativos da base */
  abstract ativos(): AtivoInfo[]

  /** Cotações do ativo, em ordem */
  abstract precos(ativoId: string): PrecoDia[]

  /** Proventos do ativo, em ordem de data-com */
  abstract proventos(ativoId: string): Provento[]

  /** Eventos do ativo, em ordem de data */
  abstract eventos(ativoId: string): EventoAtivo[]

  /** CDI de cada dia útil (fração ao dia) */
  abstract cdi(): Map<IsoDate, number>

  /**
   * Primeira data em que os fundamentos permitem calcular o score (antes
   * dela a simulação não tem o que recomendar)
   */
  abstract dataMinima(): IsoDate

  /**
   * Monta o estado do ativo como era conhecido na data da visão
   *
   * Só pode usar dados da visão ou, para os fundamentos próprios do tipo de
   * ativo, dados entregues antes de `view.data`
   *
   * @returns `null` se o ativo não tem dado suficiente naquela data
   */
  protected abstract montarSnapshot(
    ativo: AtivoInfo,
    view: PointInTimeView,
    base: AtivoSnapshot,
  ): TSnapshot | null

  /**
   * Verifica se o ativo participa do universo de seleção (ex.: um ETF baixado
   * só para ser benchmark não participa); padrão: todos
   */
  noUniverso(_ativo: AtivoInfo): boolean {
    return true
  }

  /**
   * Valores de uma série macroeconômica, em ordem de divulgação; padrão:
   * nenhuma série
   */
  serieMacro(_serie: string): ValorMacro[] {
    return []
  }

  /**
   * Completa os snapshots do universo com o que depende dos outros ativos da
   * mesma data (ex.: P/VP em relação à mediana do segmento); padrão: nada
   */
  protected enriquecerUniverso(snapshots: TSnapshot[]): TSnapshot[] {
    return snapshots
  }

  /** Datas de divulgação da série macro, em ordem (em cache, para as buscas) */
  divulgacoesMacro(serie: string): IsoDate[] {
    let datas = this.divulgacoesCache.get(serie)
    if (!datas) {
      datas = this.serieMacro(serie).map((valor) => valor.conhecidoEm)
      this.divulgacoesCache.set(serie, datas)
    }
    return datas
  }

  /**
   * CDI acumulado (fração) entre duas datas: taxas dos dias depois de
   * `desde` até `ate`, inclusive
   */
  cdiEntre(desde: IsoDate, ate: IsoDate): number {
    // Monta, na primeira vez, o índice acumulado do CDI
    if (!this.cdiIndice) {
      const datas = [...this.cdi().keys()].sort()
      const acumulado: number[] = []
      let valor = 1
      for (const data of datas) {
        valor *= 1 + (this.cdi().get(data) ?? 0)
        acumulado.push(valor)
      }
      this.cdiIndice = { datas, acumulado }
    }
    const { datas, acumulado } = this.cdiIndice
    const inicio = lastIndexAtOrBefore(datas, desde)
    const fim = lastIndexAtOrBefore(datas, ate)
    // Se não há CDI no período
    if (fim < 0) {
      return 0
    }
    return acumulado[fim] / (inicio >= 0 ? acumulado[inicio] : 1) - 1
  }

  /** Datas das cotações do ativo, em ordem (em cache, para as buscas) */
  datasPrecos(ativoId: string): IsoDate[] {
    let datas = this.datasCache.get(ativoId)
    if (!datas) {
      datas = this.precos(ativoId).map((preco) => preco.data)
      this.datasCache.set(ativoId, datas)
    }
    return datas
  }

  /** Visão dos dados como eram conhecidos na data */
  visao(data: IsoDate): PointInTimeView {
    return new PointInTimeView(this, data)
  }

  /** Ativo pelo identificador */
  ativo(ativoId: string): AtivoInfo | undefined {
    if (!this.ativosCache) {
      this.ativosCache = new Map(
        this.ativos().map((ativo) => [ativo.ativoId, ativo]),
      )
    }
    return this.ativosCache.get(ativoId)
  }

  /**
   * Monta o universo de ativos negociáveis na data: já negociados antes dela
   * e com negociação nos últimos pregões (ativos encerrados ou suspensos
   * ficam de fora)
   *
   * O universo de cada data fica em cache (é o mesmo em qualquer simulação);
   * quem usar o resultado não deve alterar os snapshots
   */
  universo(data: IsoDate): TSnapshot[] {
    const cache = this.universoCache.get(data)
    if (cache) {
      return cache
    }
    const snapshots = this.enriquecerUniverso(this.montarUniverso(data))
    this.universoCache.set(data, snapshots)
    return snapshots
  }

  /** Monta os snapshots dos ativos negociáveis na data */
  private montarUniverso(data: IsoDate): TSnapshot[] {
    const view = this.visao(data)
    const calendario = this.pregoes()
    const indice = lastIndexAtOrBefore(calendario, view.ate)
    // Se não há pregões antes da data
    if (indice < 0) {
      return []
    }
    const limite = calendario[Math.max(indice - PREGOES_SEM_NEGOCIACAO + 1, 0)]
    const snapshots: TSnapshot[] = []

    for (const ativo of this.ativos()) {
      // Se o ativo não participa do universo, ainda não existia ou já tinha
      // deixado de ser negociado
      if (
        !this.noUniverso(ativo) ||
        ativo.primeiraData >= data ||
        ativo.ultimaData < limite
      ) {
        continue
      }
      const ultimo = view.ultimoPreco(ativo.ativoId)
      // Se o ativo não negociou nos últimos pregões antes da data
      if (!ultimo || ultimo.data < limite) {
        continue
      }

      const snapshot = this.montarSnapshot(ativo, view, {
        ativoId: ativo.ativoId,
        ticker: ativo.ticker,
        data,
        preco: ultimo.fechamento,
        liquidezMedia: view.liquidezMedia(ativo.ativoId),
      })
      if (snapshot) {
        snapshots.push(snapshot)
      }
    }
    return snapshots
  }

  /** Fechamento do ativo no pregão; `null` se não houve negócio no dia */
  precoNoDia(ativoId: string, data: IsoDate): number | null {
    const indice = lastIndexAtOrBefore(this.datasPrecos(ativoId), data)
    const preco = indice >= 0 ? this.precos(ativoId)[indice] : null
    return preco?.data === data ? preco.fechamento : null
  }

  /** Último fechamento até a data (inclusive); `null` se nunca negociou */
  ultimoPrecoAte(ativoId: string, data: IsoDate): PrecoDia | null {
    const indice = lastIndexAtOrBefore(this.datasPrecos(ativoId), data)
    return indice >= 0 ? this.precos(ativoId)[indice] : null
  }

  /**
   * Fator de desdobramento entre duas datas: cotas em `ate` por cota em
   * `desde` (eventos depois de `desde` até `ate`, inclusive)
   */
  fatorEntre(ativoId: string, desde: IsoDate, ate: IsoDate): number {
    return this.eventos(ativoId)
      .filter((evento) => evento.data > desde && evento.data <= ate)
      .reduce((fator, evento) => fator * (evento.fator ?? 1), 1)
  }
}
