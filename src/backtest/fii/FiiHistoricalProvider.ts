import {
  buildCvmFundosFromRows,
  type CvmRow,
  type CvmRows,
} from '../../sources/cvm/build.js'
import type { CvmFundo } from '../../types/cvm.type.js'
import type { Segmento } from '../../types/fundo.types.js'
import FiiIndicators from '../../utils/FiiIndicators.js'
import FiiQualidade from '../../utils/FiiQualidade.js'
import {
  addDays,
  addMonths,
  daysBetween,
  endOfMonth,
  lastIndexAtOrBefore,
} from '../core/dates.js'
import {
  type AtivoInfo,
  type AtivoSnapshot,
  HistoricalDataProvider,
  type PointInTimeView,
  type PrecoDia,
  type Provento,
  type ValorMacro,
} from '../core/HistoricalDataProvider.js'
import {
  type IndicadoresMercado,
  type IndicadoresProventos,
  indicadoresMercado,
  indicadoresProventos,
} from '../core/mercado.js'
import type { EventoAtivo, IsoDate } from '../core/types.js'
import type { MarketDatabase } from '../data/MarketDatabase.js'
import { CODBDI_FII, FONTE_STATUSINVEST, isinsCvm } from './ingest.js'

/**
 * Estado de um FII em uma data, com o que era conhecido naquele dia
 *
 * Os campos de mercado (retornos, volatilidade, proventos) vêm de
 * `IndicadoresMercado` e `IndicadoresProventos`. A descrição de cada campo
 * para o dataset e a documentação fica em `features.ts`
 */
export interface FiiSnapshot
  extends AtivoSnapshot,
    IndicadoresMercado,
    IndicadoresProventos {
  cnpj: string | null
  nome: string | null
  /** Classe pela composição do ativo no informe mensal */
  segmento: Segmento | null
  /** Segmento de atuação declarado à CVM (Logística, Shoppings...) */
  segmentoAtuacao: string | null
  /** Mandato declarado à CVM (Renda, Títulos e Valores Mobiliários...) */
  mandato: string | null
  /** Ativa ou Passiva */
  tipoGestao: string | null
  /** Anos desde o início do funcionamento (CVM) ou, sem ele, da 1ª negociação na base */
  idadeAnos: number | null
  /** Data de referência do informe mensal usado */
  informeMensal: IsoDate | null
  /** Data de entrega do informe mensal usado */
  informeMensalEntregue: IsoDate | null
  /** Dias entre a entrega do informe mensal usado e a data */
  diasDesdeInforme: number | null
  /** Valor patrimonial por cota, na base de cotas atual */
  vpCota: number | null
  pvp: number | null
  /** Variação do valor patrimonial da cota em 12 meses (%), ajustada por desdobramento */
  variacaoVp12m: number | null
  /** % ao ano */
  taxaAdministracao: number | null
  /** % do ativo */
  alavancagem: number | null
  /** Vacância média dos imóveis de renda, pesada pela área (%) */
  vacancia: number | null
  diversificado: boolean | null
  limiteDistribuicao: boolean | null
  /** Ativos de liquidez (caixa, títulos, fundos de renda fixa) / ativo total (%) */
  percentualCaixa: number | null
  numeroCotistas: number | null
  /** Variação do número de cotistas em 12 meses (%) */
  crescimentoCotistas12m: number | null
  patrimonioLiquido: number | null
  /** Aumento da quantidade de cotas em 12 meses por emissões (%), sem desdobramentos */
  emissao12m: number | null
  /** Meta da Selic (% a.a.) conhecida na data */
  selicMeta: number | null
  /** IPCA em 12 meses (%) já divulgado na data */
  ipca12m: number | null
  /** Juro real da NTN-B de ~10 anos (% a.a.) */
  ntnbJuroReal: number | null
  /** CDI acumulado nos últimos 12 meses (%) */
  cdi12m: number | null
  /** DY 12m menos o juro real da NTN-B (pontos percentuais) */
  spreadDyNtnb: number | null
  /** P/VP / mediana do P/VP dos fundos do mesmo segmento na data */
  pvpRelativoSegmento: number | null
  /** DY 12m menos a mediana do DY dos fundos do mesmo segmento (p.p.) */
  dyRelativoSegmento: number | null
  /** Fundos do mesmo segmento com dado na data */
  fundosNoSegmento: number | null
}

/** Linha de informe carregada da base */
interface LinhaCvm {
  arquivo: string
  dataReferencia: IsoDate
  versao: number
  dataEntrega: IsoDate
  dados: CvmRow
}

/** Fundo montado com os informes entregues até um ponto, em cache */
interface FundoEmCache {
  /** Quantas linhas (em ordem de entrega) entraram na montagem */
  entregues: number
  fundo: CvmFundo | null
  /** Última versão entregue do complemento mensal de cada mês, por referência */
  mensais: Map<IsoDate, LinhaCvm>
  /** Último complemento mensal (versão mais recente entregue) */
  mensal: LinhaCvm | null
  /** Último informe geral mensal (segmento, mandato, gestão) */
  geral: CvmRow | null
  /** Ativo/passivo do mesmo mês do último complemento */
  ativoPassivo: CvmRow | null
}

/**
 * Arquivos em que só o informe mais recente interessa (a montagem do fundo
 * descarta os anteriores; passar só o último poupa trabalho)
 */
const SO_ULTIMO_INFORME = new Set([
  'inf_trimestral_fii_imovel',
  'inf_trimestral_fii_ativo',
])

/** Meses sem informe mensal para os fundamentos serem tratados como ausentes */
const MESES_INFORME_VELHO = 6

/** Parte dos FIIs negociados com informe entregue para a simulação poder começar */
const COBERTURA_MINIMA_CVM = 0.5

/** Mínimo de fundos no segmento para a comparação com a mediana valer */
const MINIMO_FUNDOS_SEGMENTO = 5

/** Converte um número da CVM; `null` se vazio ou inválido */
function numero(texto: string | undefined): number | null {
  // Se o campo está vazio
  if (texto === undefined || texto.trim() === '') {
    return null
  }
  const valor = Number(texto)
  return Number.isFinite(valor) ? valor : null
}

/** Arredonda para 4 casas */
function arredondar(valor: number): number {
  return Math.round(valor * 10_000) / 10_000
}

/** Variação percentual de `antes` para `depois`; `null` sem valores positivos */
function variacao(depois: number | null, antes: number | null): number | null {
  return depois !== null && antes !== null && antes > 0 && depois > 0
    ? arredondar((depois / antes - 1) * 100)
    : null
}

/** Mediana; `null` com lista vazia */
function mediana(valores: number[]): number | null {
  // Se não há valores
  if (valores.length === 0) {
    return null
  }
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = ordenados.length >> 1
  return ordenados.length % 2
    ? ordenados[meio]
    : (ordenados[meio - 1] + ordenados[meio]) / 2
}

/** Mantém a linha mais recente (referência e, nela, versão) */
function maisRecente(atual: LinhaCvm | null, linha: LinhaCvm): LinhaCvm {
  return !atual ||
    linha.dataReferencia > atual.dataReferencia ||
    (linha.dataReferencia === atual.dataReferencia &&
      linha.versao > atual.versao)
    ? linha
    : atual
}

/**
 * Deduz a classe do fundo pela composição do ativo: a classe com mais
 * dinheiro, ou Híbrido se nenhuma tiver 60% do total
 */
export function segmentoPelaComposicao(
  fundo: CvmFundo | null,
): Segmento | null {
  const composicao = fundo?.composicao
  // Se o fundo não informou a composição
  if (!composicao) {
    return null
  }
  const classes: [Segmento, number][] = [
    ['Tijolo', composicao.imoveis],
    ['Papel', composicao.cri],
    ['FoF', composicao.fii],
  ]
  const total = classes.reduce((sum, [, valor]) => sum + valor, 0)
  // Se o fundo não tem nenhuma das classes
  if (total <= 0) {
    return null
  }
  const [segmento, valor] = classes.reduce((maior, atual) =>
    atual[1] > maior[1] ? atual : maior,
  )
  return valor / total >= 0.6 ? segmento : 'Híbrido'
}

/** Vacância média dos imóveis de renda prontos, pesada pela área (%) */
export function vacanciaMedia(fundo: CvmFundo | null): number | null {
  const imoveis = (fundo?.imoveis ?? []).filter(
    (imovel) => imovel.classe === 'renda_acabado' && imovel.vacancia !== null,
  )
  // Se o fundo não tem imóvel de renda com vacância informada
  if (imoveis.length === 0) {
    return null
  }
  const usaArea = imoveis.some((imovel) => imovel.area > 0)
  const peso = (area: number) => (usaArea ? area : 1)
  const total = imoveis.reduce((sum, imovel) => sum + peso(imovel.area), 0)
  const vaga = imoveis.reduce(
    (sum, imovel) => sum + peso(imovel.area) * (imovel.vacancia ?? 0),
    0,
  )
  return total > 0 ? arredondar((vaga / total) * 100) : null
}

/**
 * Dados históricos de FIIs: cotações do COTAHIST, proventos do statusinvest
 * (ou estimados pela CVM), fundamentos dos informes da CVM (respeitando a
 * data de entrega de cada informe) e séries macro
 */
export class FiiHistoricalProvider extends HistoricalDataProvider<FiiSnapshot> {
  readonly tipoAtivo = 'fii'

  private readonly listaPregoes: IsoDate[]
  private readonly listaAtivos: AtivoInfo[]
  private readonly fiis = new Set<string>()
  private readonly mapaPrecos = new Map<string, PrecoDia[]>()
  private readonly mapaProventos = new Map<string, Provento[]>()
  private readonly mapaEventos = new Map<string, EventoAtivo[]>()
  private readonly mapaCdi = new Map<IsoDate, number>()
  private readonly mapaMacro = new Map<string, ValorMacro[]>()
  /** Linhas da CVM de cada CNPJ, em ordem de entrega */
  private readonly linhasCvm = new Map<string, LinhaCvm[]>()
  private readonly entregasCvm = new Map<string, IsoDate[]>()
  private readonly isinParaCnpj: Map<string, string>
  private readonly cacheFundos = new Map<string, FundoEmCache>()
  private minima: IsoDate | null = null

  /** Carrega a base inteira na memória */
  constructor(private readonly db: MarketDatabase) {
    super()
    const sql = db.db

    // Carrega os pregões (dias com negócio de algum FII) e os ativos
    this.listaPregoes = (
      sql
        .prepare(
          `SELECT DISTINCT p.data FROM preco p JOIN ativo a USING (ativo_id)
           WHERE a.codbdi = ? ORDER BY p.data`,
        )
        .all(CODBDI_FII) as { data: string }[]
    ).map((row) => row.data)
    const ativos = sql
      .prepare(
        'SELECT ativo_id, ticker, codbdi, primeira_data, ultima_data FROM ativo',
      )
      .all() as {
      ativo_id: string
      ticker: string
      codbdi: string
      primeira_data: string
      ultima_data: string
    }[]
    this.listaAtivos = ativos.map((row) => ({
      ativoId: row.ativo_id,
      ticker: row.ticker,
      primeiraData: row.primeira_data,
      ultimaData: row.ultima_data,
    }))
    for (const row of ativos) {
      if (row.codbdi === CODBDI_FII) {
        this.fiis.add(row.ativo_id)
      }
    }

    // Carrega as cotações
    for (const row of sql
      .prepare(
        'SELECT ativo_id, data, fechamento, volume FROM preco ORDER BY ativo_id, data',
      )
      .all() as {
      ativo_id: string
      data: string
      fechamento: number
      volume: number
    }[]) {
      const lista = this.mapaPrecos.get(row.ativo_id) ?? []
      lista.push({
        data: row.data,
        fechamento: row.fechamento,
        volume: row.volume,
      })
      this.mapaPrecos.set(row.ativo_id, lista)
    }

    // Carrega os proventos: do statusinvest quando há; senão, os estimados
    const comStatusInvest = new Set(
      (
        sql
          .prepare('SELECT DISTINCT ativo_id FROM provento WHERE fonte = ?')
          .all(FONTE_STATUSINVEST) as { ativo_id: string }[]
      ).map((row) => row.ativo_id),
    )
    for (const row of sql
      .prepare(
        `SELECT ativo_id, data_com, data_pagamento, valor, tipo, fonte
         FROM provento ORDER BY ativo_id, data_com`,
      )
      .all() as {
      ativo_id: string
      data_com: string
      data_pagamento: string
      valor: number
      tipo: string
      fonte: string
    }[]) {
      // Se o ativo tem statusinvest e o provento é de outra fonte
      if (
        comStatusInvest.has(row.ativo_id) &&
        row.fonte !== FONTE_STATUSINVEST
      ) {
        continue
      }
      const lista = this.mapaProventos.get(row.ativo_id) ?? []
      lista.push({
        ativoId: row.ativo_id,
        dataCom: row.data_com,
        dataPagamento: row.data_pagamento,
        valor: row.valor,
        tipo: row.tipo,
        fonte: row.fonte,
      })
      this.mapaProventos.set(row.ativo_id, lista)
    }

    // Carrega os eventos, o CDI e as séries macro
    for (const row of sql
      .prepare(
        'SELECT ativo_id, data, tipo, fator, descricao, fonte FROM evento ORDER BY ativo_id, data',
      )
      .all() as {
      ativo_id: string
      data: string
      tipo: string
      fator: number | null
      descricao: string | null
      fonte: string
    }[]) {
      const lista = this.mapaEventos.get(row.ativo_id) ?? []
      lista.push({
        ativoId: row.ativo_id,
        data: row.data,
        tipo: row.tipo,
        ...(row.fator ? { fator: row.fator } : {}),
        ...(row.descricao ? { descricao: row.descricao } : {}),
        fonte: row.fonte,
      })
      this.mapaEventos.set(row.ativo_id, lista)
    }
    for (const row of sql.prepare('SELECT data, taxa FROM cdi').all() as {
      data: string
      taxa: number
    }[]) {
      this.mapaCdi.set(row.data, row.taxa)
    }
    for (const row of sql
      .prepare(
        'SELECT serie, data, valor, conhecido_em FROM macro ORDER BY serie, conhecido_em, data',
      )
      .all() as {
      serie: string
      data: string
      valor: number
      conhecido_em: string
    }[]) {
      const lista = this.mapaMacro.get(row.serie) ?? []
      lista.push({
        data: row.data,
        valor: row.valor,
        conhecidoEm: row.conhecido_em,
      })
      this.mapaMacro.set(row.serie, lista)
    }

    // Carrega as linhas da CVM em ordem de entrega
    for (const row of sql
      .prepare(
        `SELECT cnpj, arquivo, data_referencia, versao, data_entrega, dados
         FROM cvm_linha ORDER BY cnpj, data_entrega, data_referencia, versao`,
      )
      .all() as {
      cnpj: string
      arquivo: string
      data_referencia: string
      versao: number
      data_entrega: string
      dados: string
    }[]) {
      const lista = this.linhasCvm.get(row.cnpj) ?? []
      lista.push({
        arquivo: row.arquivo,
        dataReferencia: row.data_referencia,
        versao: row.versao,
        dataEntrega: row.data_entrega,
        dados: JSON.parse(row.dados),
      })
      this.linhasCvm.set(row.cnpj, lista)
    }
    for (const [cnpj, linhas] of this.linhasCvm) {
      this.entregasCvm.set(
        cnpj,
        linhas.map((linha) => linha.dataEntrega),
      )
    }
    this.isinParaCnpj = isinsCvm(db)
  }

  pregoes(): IsoDate[] {
    return this.listaPregoes
  }

  ativos(): AtivoInfo[] {
    return this.listaAtivos
  }

  precos(ativoId: string): PrecoDia[] {
    return this.mapaPrecos.get(ativoId) ?? []
  }

  proventos(ativoId: string): Provento[] {
    return this.mapaProventos.get(ativoId) ?? []
  }

  eventos(ativoId: string): EventoAtivo[] {
    return this.mapaEventos.get(ativoId) ?? []
  }

  cdi(): Map<IsoDate, number> {
    return this.mapaCdi
  }

  override serieMacro(serie: string): ValorMacro[] {
    return this.mapaMacro.get(serie) ?? []
  }

  /** Só FIIs participam do universo (ETFs baixados servem de benchmark) */
  override noUniverso(ativo: AtivoInfo): boolean {
    return this.fiis.has(ativo.ativoId)
  }

  /**
   * Primeiro dia do primeiro mês em que ao menos metade dos FIIs negociados
   * já tinha informe mensal entregue
   */
  dataMinima(): IsoDate {
    if (this.minima) {
      return this.minima
    }
    // Se a base não tem pregões
    if (this.listaPregoes.length === 0) {
      return '9999-12-31'
    }

    // Carrega a primeira entrega de cada FII com informe
    const primeiraEntrega = new Map<string, IsoDate>()
    for (const [isin, cnpj] of this.isinParaCnpj) {
      const entrega = this.entregasCvm.get(cnpj)?.[0]
      if (entrega) {
        primeiraEntrega.set(isin, entrega)
      }
    }

    // Procura, mês a mês, a primeira data com cobertura suficiente
    let mes = `${this.listaPregoes[0].slice(0, 7)}-01`
    const ultimo = this.listaPregoes[this.listaPregoes.length - 1]
    while (mes <= ultimo) {
      const negociados = [...this.fiis].filter((ativoId) => {
        const ativo = this.ativo(ativoId)
        return ativo && ativo.primeiraData < mes && ativo.ultimaData >= mes
      })
      const cobertos = negociados.filter(
        (ativoId) => (primeiraEntrega.get(ativoId) ?? '9999') < mes,
      )
      if (
        negociados.length > 0 &&
        cobertos.length / negociados.length >= COBERTURA_MINIMA_CVM
      ) {
        this.minima = mes
        return mes
      }
      mes = addMonths(mes, 1)
    }
    this.minima = ultimo
    return ultimo
  }

  /** Identifica o estado da base: controles da ingestão e contagens */
  versaoDados(): string {
    const ultima = this.db.db
      .prepare('SELECT max(atualizado_em) AS ultima FROM ingestao')
      .get() as { ultima: string | null }
    return [
      ultima.ultima ?? 'sem-ingestao',
      `precos=${[...this.mapaPrecos.values()].reduce((s, l) => s + l.length, 0)}`,
      `proventos=${[...this.mapaProventos.values()].reduce((s, l) => s + l.length, 0)}`,
      `eventos=${[...this.mapaEventos.values()].reduce((s, l) => s + l.length, 0)}`,
      `cvm=${[...this.linhasCvm.values()].reduce((s, l) => s + l.length, 0)}`,
      `macro=${[...this.mapaMacro.values()].reduce((s, l) => s + l.length, 0)}`,
    ].join(';')
  }

  /**
   * Monta o fundo com as linhas da CVM entregues antes da data (em cache até
   * chegar um informe novo)
   */
  private fundoAte(cnpj: string, data: IsoDate): FundoEmCache {
    const linhas = this.linhasCvm.get(cnpj) ?? []
    const entregues =
      lastIndexAtOrBefore(this.entregasCvm.get(cnpj) ?? [], addDays(data, -1)) +
      1
    const cache = this.cacheFundos.get(cnpj)
    // Se nenhum informe novo foi entregue desde a última montagem
    if (cache && cache.entregues === entregues) {
      return cache
    }

    // Separa as linhas conhecidas por arquivo e guarda a última versão de
    // cada mês do complemento e os informes mais recentes
    const conhecidas = linhas.slice(0, entregues)
    const porArquivo: CvmRows = {}
    const mensais = new Map<IsoDate, LinhaCvm>()
    let mensal: LinhaCvm | null = null
    let geral: LinhaCvm | null = null
    const ativosPassivos = new Map<IsoDate, LinhaCvm>()
    for (const linha of conhecidas) {
      const lista = porArquivo[linha.arquivo] ?? []
      lista.push(linha.dados)
      porArquivo[linha.arquivo] = lista

      if (linha.arquivo === 'inf_mensal_fii_complemento') {
        const atual = mensais.get(linha.dataReferencia) ?? null
        mensais.set(linha.dataReferencia, maisRecente(atual, linha))
        mensal = maisRecente(mensal, linha)
      } else if (linha.arquivo === 'inf_mensal_fii_geral') {
        geral = maisRecente(geral, linha)
      } else if (linha.arquivo === 'inf_mensal_fii_ativo_passivo') {
        const atual = ativosPassivos.get(linha.dataReferencia) ?? null
        ativosPassivos.set(linha.dataReferencia, maisRecente(atual, linha))
      }
    }

    // Mantém só o informe mais recente dos arquivos de imóveis e carteira
    for (const arquivo of SO_ULTIMO_INFORME) {
      const lista = conhecidas.filter((linha) => linha.arquivo === arquivo)
      // Se o arquivo não tem linha conhecida
      if (lista.length === 0) {
        continue
      }
      const ultima = lista.reduce<LinhaCvm | null>(maisRecente, null)
      porArquivo[arquivo] = lista
        .filter(
          (linha) =>
            linha.dataReferencia === ultima?.dataReferencia &&
            linha.versao === ultima.versao,
        )
        .map((linha) => linha.dados)
    }

    const novo: FundoEmCache = {
      entregues,
      fundo: buildCvmFundosFromRows(porArquivo).get(cnpj) ?? null,
      mensais,
      mensal,
      geral: geral?.dados ?? null,
      ativoPassivo: mensal
        ? (ativosPassivos.get(mensal.dataReferencia)?.dados ?? null)
        : null,
    }
    this.cacheFundos.set(cnpj, novo)
    return novo
  }

  protected montarSnapshot(
    ativo: AtivoInfo,
    view: PointInTimeView,
    base: AtivoSnapshot,
  ): FiiSnapshot {
    // Calcula os indicadores de mercado e de proventos (antes da data)
    const mercado = indicadoresMercado(view, ativo.ativoId)
    const proventos = indicadoresProventos(view, ativo.ativoId, base.preco)

    // Carrega o macro conhecido na data
    const ntnb = view.macro('ntnb_10a')?.valor ?? null
    const cdi12m = this.cdi().size > 0 ? view.cdiAcumulado(365) : null

    const snapshot: FiiSnapshot = {
      ...base,
      ...mercado,
      ...proventos,
      cnpj: this.isinParaCnpj.get(ativo.ativoId) ?? null,
      nome: null,
      segmento: null,
      segmentoAtuacao: null,
      mandato: null,
      tipoGestao: null,
      idadeAnos: arredondar(
        daysBetween(ativo.primeiraData, view.data) / 365.25,
      ),
      informeMensal: null,
      informeMensalEntregue: null,
      diasDesdeInforme: null,
      vpCota: null,
      pvp: null,
      variacaoVp12m: null,
      taxaAdministracao: null,
      alavancagem: null,
      vacancia: null,
      diversificado: null,
      limiteDistribuicao: null,
      percentualCaixa: null,
      numeroCotistas: null,
      crescimentoCotistas12m: null,
      patrimonioLiquido: null,
      emissao12m: null,
      selicMeta: view.macro('selic_meta')?.valor ?? null,
      ipca12m: view.macro('ipca_12m')?.valor ?? null,
      ntnbJuroReal: ntnb,
      cdi12m: cdi12m === null ? null : arredondar(cdi12m * 100),
      spreadDyNtnb:
        proventos.dy12m !== null && ntnb !== null
          ? arredondar(proventos.dy12m - ntnb)
          : null,
      pvpRelativoSegmento: null,
      dyRelativoSegmento: null,
      fundosNoSegmento: null,
    }
    // Se o fundo não tem informe na CVM
    if (!snapshot.cnpj) {
      return snapshot
    }

    // Monta o fundo com os informes entregues antes da data
    const cache = this.fundoAte(snapshot.cnpj, view.data)
    const { fundo, mensal, geral } = cache
    const referencia = mensal?.dataReferencia ?? null
    // Se não há informe mensal ou ele é velho demais (o fundo parou de informar)
    if (
      !fundo ||
      !mensal ||
      !referencia ||
      referencia < addMonths(view.data, -MESES_INFORME_VELHO)
    ) {
      return snapshot
    }
    const dados = mensal.dados

    // Converte o valor patrimonial da cota (apurado no fim do mês de
    // referência) para a base de cotas atual
    const fatorAtual = view.fatorAjuste(ativo.ativoId, endOfMonth(referencia))
    const vp = numero(dados.Valor_Patrimonial_Cotas)
    const vpCota = vp && vp > 0 ? vp / fatorAtual : null

    // Compara com o informe de 12 meses antes (cotas e VP ajustados pelos
    // desdobramentos do período)
    const anterior = cache.mensais.get(addMonths(referencia, -12))?.dados
    const fatorPeriodo = anterior
      ? view.fatorAjuste(
          ativo.ativoId,
          endOfMonth(addMonths(referencia, -12)),
        ) / fatorAtual
      : 1
    const cotas = numero(dados.Cotas_Emitidas)
    const cotasAntes = numero(anterior?.Cotas_Emitidas)
    const vpAntes = numero(anterior?.Valor_Patrimonial_Cotas)

    // Calcula o caixa pelo ativo/passivo do mesmo mês
    const disponibilidades = numero(
      cache.ativoPassivo?.Total_Necessidades_Liquidez,
    )
    const valorAtivo = numero(dados.Valor_Ativo)

    // Calcula a idade pelo início do funcionamento, se informado
    const funcionamento = geral?.Data_Funcionamento?.trim()
    const segmento = segmentoPelaComposicao(fundo)
    return {
      ...snapshot,
      nome: geral?.Nome_Fundo_Classe?.trim() || null,
      segmento,
      segmentoAtuacao: geral?.Segmento_Atuacao?.trim() || null,
      mandato: geral?.Mandato?.trim() || null,
      tipoGestao: geral?.Tipo_Gestao?.trim() || null,
      idadeAnos:
        funcionamento && /^\d{4}-\d{2}-\d{2}$/.test(funcionamento)
          ? arredondar(daysBetween(funcionamento, view.data) / 365.25)
          : snapshot.idadeAnos,
      informeMensal: referencia,
      informeMensalEntregue: mensal.dataEntrega,
      diasDesdeInforme: daysBetween(mensal.dataEntrega, view.data),
      vpCota: vpCota ? arredondar(vpCota) : null,
      pvp: vpCota ? arredondar(base.preco / vpCota) : null,
      variacaoVp12m:
        vp && vpAntes ? variacao(vp * fatorPeriodo, vpAntes) : null,
      taxaAdministracao: FiiIndicators.taxaAdministracao(fundo),
      alavancagem: FiiIndicators.alavancagem(fundo),
      vacancia:
        segmento === 'Tijolo' || segmento === 'Híbrido'
          ? vacanciaMedia(fundo)
          : null,
      diversificado: segmento
        ? FiiQualidade.diversificacao(segmento, fundo).diversificado
        : null,
      limiteDistribuicao: FiiIndicators.limiteDistribuicao(fundo).respeitado,
      percentualCaixa:
        disponibilidades !== null && valorAtivo && valorAtivo > 0
          ? arredondar((disponibilidades / valorAtivo) * 100)
          : null,
      numeroCotistas: numero(dados.Total_Numero_Cotistas),
      crescimentoCotistas12m: variacao(
        numero(dados.Total_Numero_Cotistas),
        numero(anterior?.Total_Numero_Cotistas),
      ),
      patrimonioLiquido: numero(dados.Patrimonio_Liquido),
      emissao12m:
        cotas && cotasAntes ? variacao(cotas / fatorPeriodo, cotasAntes) : null,
    }
  }

  /**
   * Compara cada fundo com a mediana do seu segmento na mesma data (P/VP e
   * DY), com pelo menos 5 fundos no segmento
   */
  protected override enriquecerUniverso(
    snapshots: FiiSnapshot[],
  ): FiiSnapshot[] {
    // Agrupa os fundos por segmento
    const grupos = new Map<string, FiiSnapshot[]>()
    for (const snapshot of snapshots) {
      if (snapshot.segmento) {
        const grupo = grupos.get(snapshot.segmento) ?? []
        grupo.push(snapshot)
        grupos.set(snapshot.segmento, grupo)
      }
    }

    // Calcula a mediana de cada grupo e a posição de cada fundo
    for (const grupo of grupos.values()) {
      const pvps = grupo
        .map((s) => s.pvp)
        .filter((v): v is number => v !== null && v > 0)
      const dys = grupo
        .map((s) => s.dy12m)
        .filter((v): v is number => v !== null)
      const medianaPvp =
        pvps.length >= MINIMO_FUNDOS_SEGMENTO ? mediana(pvps) : null
      const medianaDy =
        dys.length >= MINIMO_FUNDOS_SEGMENTO ? mediana(dys) : null
      for (const snapshot of grupo) {
        snapshot.fundosNoSegmento = grupo.length
        snapshot.pvpRelativoSegmento =
          snapshot.pvp !== null && medianaPvp
            ? arredondar(snapshot.pvp / medianaPvp)
            : null
        snapshot.dyRelativoSegmento =
          snapshot.dy12m !== null && medianaDy !== null
            ? arredondar(snapshot.dy12m - medianaDy)
            : null
      }
    }
    return snapshots
  }
}
