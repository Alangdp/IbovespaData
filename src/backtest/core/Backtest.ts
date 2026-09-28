import {
  analisarFaixas,
  type FaixaScore,
  HORIZONTES_PADRAO,
  type ObservacaoScore,
  type RetornoFuturo,
  retornoEntre,
  retornosFuturos,
} from './analysis.js'
import { Benchmark } from './Benchmark.js'
import { validarConfig } from './configSchema.js'
import {
  addDays,
  addMonths,
  datasAporte,
  datasRebalanceamento,
  lastIndexAtOrBefore,
} from './dates.js'
import type {
  AtivoSnapshot,
  HistoricalDataProvider,
} from './HistoricalDataProvider.js'
import { calcularMetricas, type SerieCarteira } from './metrics.js'
import { Portfolio } from './Portfolio.js'
import type { Faixa, Scorer } from './Scorer.js'
import type {
  BacktestConfig,
  BacktestConfigResolvida,
  DividendoRecebido,
  IsoDate,
  ItemRanking,
  Operacao,
  PontoCarteira,
  Recomendacao,
  ResumoSimulacao,
} from './types.js'
import { versaoCodigo } from './versao.js'

/** Pregões sem negociação para a posição ser encerrada ao último preço */
const PREGOES_ENCERRAMENTO = 30

/** Recomendação com o que aconteceu depois dela */
export interface RecomendacaoAnalisada extends Recomendacao {
  retornos: RetornoFuturo[]
}

/** Resultado completo de uma simulação */
export interface ResultadoBacktest {
  id: string
  criadoEm: string
  tipoAtivo: string
  scoreVersao: string
  scoreDescricao: string
  benchmarkNome: string
  /** Identifica o estado da base de dados usada (reprodutibilidade) */
  dadosVersao: string
  /** Commit do código (com `+alterado` se havia mudanças não commitadas) */
  codigoVersao: string
  /** Critérios, pesos e faixas do score usado (para reproduzir a versão) */
  scoreConfig: {
    coberturaMinima: number
    criterios: { criterio: string; peso: number; faixa?: Faixa }[]
  }
  config: BacktestConfigResolvida
  resumo: ResumoSimulacao
  /** Todos os ativos com score em cada data de aporte (selecionados ou não) */
  recomendacoes: RecomendacaoAnalisada[]
  operacoes: Operacao[]
  dividendos: DividendoRecebido[]
  carteira: PontoCarteira[]
  faixas: FaixaScore[]
  posicoesFinais: {
    ativoId: string
    ticker: string
    quantidade: number
    precoMedio: number
    preco: number
    valor: number
  }[]
  avisos: string[]
}

/**
 * Simulação histórica de aportes seguindo o ranking de um score
 *
 * A base faz o laço da timeline e é igual para qualquer tipo de ativo; cada
 * tipo estende a classe e diz qual provider usa e quais versões de score
 * existem
 *
 * Em cada pregão, nesta ordem:
 * 1. aplica os desdobramentos e paga os proventos do dia
 * 2. encerra as posições sem negociação há muito tempo
 * 3. provisiona os proventos com data-com entre o pregão anterior e hoje
 * 4. no dia de aporte: monta o universo com os dados conhecidos antes do dia,
 *    calcula o score e o ranking, seleciona, rebalanceia (se for o dia),
 *    compra no fechamento e registra as recomendações
 * 5. provisiona os proventos com data-com hoje (quem comprou hoje recebe)
 * 6. avalia a carteira e o benchmark no fechamento
 */
export abstract class Backtest<TSnapshot extends AtivoSnapshot> {
  constructor(readonly provider: HistoricalDataProvider<TSnapshot>) {}

  /** Versões de score disponíveis para o tipo de ativo */
  abstract versoesScore(): string[]

  /**
   * Instancia o score da versão
   *
   * @throws Error se a versão não existir
   */
  abstract criarScorer(versao: string): Scorer<TSnapshot>

  /** Identifica o estado da base de dados (padrão: sem controle) */
  versaoDados(): string {
    return 'desconhecida'
  }

  /**
   * Aplica os padrões e resolve o período da configuração, ajustando o início
   * para a primeira data com fundamentos
   */
  resolverConfig(entrada: BacktestConfig): {
    config: BacktestConfigResolvida
    avisos: string[]
  } {
    // Valida os campos (a entrada pode vir de um JSON ou de uma rota)
    const config = validarConfig(entrada)
    const avisos: string[] = []
    const pregoes = this.provider.pregoes()
    // Se a base não tem cotações
    if (pregoes.length === 0) {
      throw new Error('base histórica vazia: rode a ingestão antes')
    }

    // Resolve o fim (último pregão da base, no máximo) e o início
    const ultimo = pregoes[pregoes.length - 1]
    const fim = config.fim && config.fim < ultimo ? config.fim : ultimo
    let inicio =
      config.inicio ??
      (config.anos
        ? addMonths(fim, -12 * config.anos)
        : this.provider.dataMinima())
    const minima = this.provider.dataMinima()
    if (inicio < minima) {
      avisos.push(
        `o período pedido começa em ${inicio}, antes dos dados necessários para o score; a simulação começa em ${minima}`,
      )
      inicio = minima
    }
    // Se o período ficou vazio
    if (inicio > fim) {
      throw new Error(`período vazio: início ${inicio} depois do fim ${fim}`)
    }

    return {
      avisos,
      config: {
        nome: config.nome ?? null,
        inicio,
        fim,
        saldoInicial: config.saldoInicial ?? 0,
        cotasIniciais: config.cotasIniciais ?? [],
        aporte: { dia: 1, ...config.aporte },
        selecao: {
          scoreMinimo: 0,
          liquidezMinima: 0,
          ...config.selecao,
        },
        distribuicao: config.distribuicao,
        reinvestirDividendos: config.reinvestirDividendos,
        rebalanceamento: config.rebalanceamento,
        benchmark: config.benchmark,
        score: config.score,
        fracionado: config.fracionado ?? false,
        aliquotaIr: config.aliquotaIr ?? 0.2,
        custoOperacao: config.custoOperacao ?? 0.0003,
        horizontes: config.horizontes ?? HORIZONTES_PADRAO,
      },
    }
  }

  /**
   * Executa a mesma simulação com cada versão de score (mesmo período, mesmos
   * aportes, mesma base), para comparar as versões
   */
  comparar(config: BacktestConfig, versoes: string[]): ResultadoBacktest[] {
    return versoes.map((versao) => this.executar({ ...config, score: versao }))
  }

  /** Executa a simulação */
  executar(entrada: BacktestConfig): ResultadoBacktest {
    const { config, avisos } = this.resolverConfig(entrada)
    const scorer = this.criarScorer(config.score)
    const benchmark = Benchmark.criar(
      config.benchmark,
      this.provider,
      config.selecao.liquidezMinima,
    )
    const provider = this.provider

    // Carrega os pregões da simulação e o pregão anterior ao início
    const calendario = provider.pregoes()
    const pregoes = calendario.filter(
      (data) => data >= config.inicio && data <= config.fim,
    )
    const indiceInicio = lastIndexAtOrBefore(
      calendario,
      addDays(config.inicio, -1),
    )
    const anteriorAoInicio =
      indiceInicio >= 0 ? calendario[indiceInicio] : config.inicio

    // Calcula as datas de aporte e de rebalanceamento
    const aportes = new Set(
      datasAporte(pregoes, config.aporte.frequencia, config.aporte.dia),
    )
    const rebalanceamentos = datasRebalanceamento(
      [...aportes],
      config.rebalanceamento.frequencia,
    )

    // Calcula o índice do benchmark e carrega o CDI
    const indiceBenchmark = benchmark.indice(pregoes)
    const cdi = provider.cdi()

    const carteira = new Portfolio(
      {
        fracionado: config.fracionado,
        custoOperacao: config.custoOperacao,
        aliquotaIr: config.aliquotaIr,
      },
      config.reinvestirDividendos,
    )
    const recomendacoes: Recomendacao[] = []
    const pontos: PontoCarteira[] = []
    let cotas = 0
    let cotasBenchmark = 0
    let indiceBase: number | null = null

    const precoAte = (ativoId: string, data: IsoDate) =>
      provider.ultimoPrecoAte(ativoId, data)?.fechamento ?? null

    for (let i = 0; i < pregoes.length; i++) {
      const hoje = pregoes[i]
      const ontem = i > 0 ? pregoes[i - 1] : anteriorAoInicio

      // 1. Aplica os desdobramentos do dia e paga os proventos
      for (const posicao of [...carteira.posicoes.values()]) {
        for (const evento of provider.eventos(posicao.ativoId)) {
          if (evento.fator && evento.data > ontem && evento.data <= hoje) {
            carteira.desdobrar(
              hoje,
              posicao.ativoId,
              evento.fator,
              precoAte(posicao.ativoId, hoje) ?? 0,
            )
          }
        }
      }
      carteira.receberProventos(hoje)

      // 2. Encerra as posições sem negociação há muito tempo, ao último preço
      const limite =
        calendario[
          Math.max(
            lastIndexAtOrBefore(calendario, hoje) - PREGOES_ENCERRAMENTO,
            0,
          )
        ]
      for (const posicao of [...carteira.posicoes.values()]) {
        const ultimo = provider.ultimoPrecoAte(posicao.ativoId, hoje)
        // Se o ativo negociou recentemente
        if (ultimo && ultimo.data > limite) {
          continue
        }
        carteira.vender(
          hoje,
          posicao.ativoId,
          ultimo?.fechamento ?? 0,
          `sem negociação desde ${ultimo?.data ?? '?'}`,
          'encerramento',
        )
      }

      // 3. Provisiona os proventos com data-com entre o pregão anterior e hoje
      this.provisionar(carteira, (dataCom) => dataCom > ontem && dataCom < hoje)

      // 4. No primeiro pregão, inclui as cotas e o saldo iniciais
      let fluxo = 0
      const saldoInicial = i === 0 ? config.saldoInicial : 0
      if (i === 0) {
        fluxo += this.incluirCotasIniciais(carteira, config, hoje)
      }
      if (saldoInicial > 0) {
        carteira.aportar(saldoInicial)
        fluxo += saldoInicial
      }

      // Executa o aporte do dia (o saldo inicial é investido na hora, mesmo
      // fora de uma data de aporte)
      if (aportes.has(hoje) || saldoInicial > 0) {
        if (aportes.has(hoje)) {
          carteira.aportar(config.aporte.valor)
          fluxo += config.aporte.valor
        }
        recomendacoes.push(
          ...this.aportar(
            carteira,
            scorer,
            config,
            hoje,
            rebalanceamentos.has(hoje),
          ),
        )
      }

      // 5. Provisiona os proventos com data-com hoje
      this.provisionar(carteira, (dataCom) => dataCom === hoje)

      // 6. Avalia a carteira e o benchmark no fechamento
      const posicoes = carteira.valorPosicoes((ativoId) =>
        precoAte(ativoId, hoje),
      )
      const patrimonio =
        posicoes +
        carteira.caixa +
        carteira.dividendosParados +
        carteira.proventosAReceber
      // Se ainda não houve aporte, não há carteira para avaliar
      if (carteira.aportado === 0) {
        continue
      }

      // Calcula o valor da cota antes do aporte do dia e emite as cotas novas
      const cota = cotas > 0 ? (patrimonio - fluxo) / cotas : 1
      cotas += fluxo / cota
      const indice = indiceBenchmark[i]
      indiceBase ??= indice
      cotasBenchmark += fluxo / indice

      pontos.push({
        data: hoje,
        aportado: carteira.aportado,
        posicoes,
        caixa: carteira.caixa + carteira.dividendosParados,
        patrimonio,
        cota,
        benchmarkPatrimonio: cotasBenchmark * indice,
        benchmarkCota: indice / indiceBase,
        cdiDia: cdi.get(hoje) ?? 0,
      })
    }

    return this.montarResultado(
      config,
      scorer,
      benchmark,
      carteira,
      recomendacoes,
      pontos,
      avisos,
    )
  }

  /**
   * Executa o aporte: universo e ranking com os dados conhecidos antes do
   * dia, seleção, rebalanceamento e compras no fechamento
   *
   * @returns O ranking do dia, com a decisão de cada ativo
   */
  private aportar(
    carteira: Portfolio,
    scorer: Scorer<TSnapshot>,
    config: BacktestConfigResolvida,
    hoje: IsoDate,
    rebalancear: boolean,
  ): Recomendacao[] {
    const provider = this.provider

    // Monta o universo e o ranking, com os dados de antes de hoje: só os
    // tickers pedidos (sem filtro de liquidez, já que foram escolhidos) ou,
    // sem eles, os ativos com a liquidez mínima
    const tickers = config.selecao.tickers?.length
      ? new Set(config.selecao.tickers.map((ticker) => ticker.toUpperCase()))
      : null
    const universo = provider
      .universo(hoje)
      .filter((snapshot) =>
        tickers
          ? tickers.has(snapshot.ticker)
          : snapshot.liquidezMedia >= (config.selecao.liquidezMinima ?? 0),
      )
    const ranking = scorer.ranking(universo)

    // Seleciona os primeiros do ranking com score mínimo e negócio hoje
    const selecionados: (ItemRanking & { preco: number })[] = []
    for (const item of ranking) {
      if (selecionados.length >= config.selecao.quantidade) {
        break
      }
      const preco = provider.precoNoDia(item.ativoId, hoje)
      if (item.score >= (config.selecao.scoreMinimo ?? 0) && preco) {
        selecionados.push({ ...item, preco })
      }
    }
    const idsSelecionados = new Set(selecionados.map((item) => item.ativoId))

    // Se é dia de rebalancear, vende o que saiu da seleção
    if (rebalancear && selecionados.length > 0) {
      for (const posicao of [...carteira.posicoes.values()]) {
        const preco = provider.precoNoDia(posicao.ativoId, hoje)
        // Se o ativo continua selecionado ou não negociou hoje
        if (idsSelecionados.has(posicao.ativoId) || !preco) {
          continue
        }
        carteira.vender(hoje, posicao.ativoId, preco, 'rebalanceamento')
      }
    }

    // Calcula quanto vai para cada selecionado e compra
    const valores = this.distribuir(carteira, config, selecionados)
    const compras = new Map<string, { quantidade: number; valor: number }>()
    selecionados.forEach((item, index) => {
      const quantidade = carteira.comprar(
        hoje,
        item.ativoId,
        item.ticker,
        valores[index],
        item.preco,
      )
      compras.set(item.ativoId, { quantidade, valor: quantidade * item.preco })
    })

    // Registra o ranking inteiro, marcando os selecionados
    return ranking.map((item) => {
      const compra = compras.get(item.ativoId)
      const selecionado = idsSelecionados.has(item.ativoId)
      return {
        ...item,
        data: hoje,
        selecionado,
        precoCompra: selecionado
          ? (selecionados.find((s) => s.ativoId === item.ativoId)?.preco ??
            null)
          : null,
        quantidade: compra?.quantidade ?? 0,
        valorInvestido: Math.round((compra?.valor ?? 0) * 100) / 100,
      }
    })
  }

  /**
   * Inclui na carteira as cotas que ela já tem no início, ao fechamento do
   * primeiro pregão (ou ao último antes dele, se o fundo não negociou)
   *
   * @returns O valor incluído (R$), que entra como aporte
   * @throws Error se o ticker não está na base ou não tem cotação até a data
   */
  private incluirCotasIniciais(
    carteira: Portfolio,
    config: BacktestConfigResolvida,
    hoje: IsoDate,
  ): number {
    let total = 0
    for (const { ticker, quantidade } of config.cotasIniciais) {
      // Busca o ativo pelo ticker e o preço do dia
      const ativo = this.provider
        .ativos()
        .find((item) => item.ticker === ticker.toUpperCase())
      const preco = ativo
        ? this.provider.ultimoPrecoAte(ativo.ativoId, hoje)
        : null
      // Se o ticker não está na base ou não tem cotação até o início
      if (!ativo || !preco) {
        throw new Error(
          `cotas iniciais: ${ticker} sem cotação na base até ${hoje}`,
        )
      }
      carteira.incluirPosicao(
        hoje,
        ativo.ativoId,
        ativo.ticker,
        quantidade,
        preco.fechamento,
      )
      total += quantidade * preco.fechamento
    }
    return total
  }

  /** Divide o caixa entre os selecionados, conforme a distribuição */
  private distribuir(
    carteira: Portfolio,
    config: BacktestConfigResolvida,
    selecionados: (ItemRanking & { preco: number })[],
  ): number[] {
    const caixa = carteira.caixa
    const n = selecionados.length
    // Se não há selecionados
    if (n === 0) {
      return []
    }

    // Se a distribuição é proporcional ao score
    if (config.distribuicao === 'proporcional_score') {
      const soma = selecionados.reduce((sum, item) => sum + item.score, 0)
      return selecionados.map((item) =>
        soma > 0 ? (caixa * item.score) / soma : caixa / n,
      )
    }

    // Se a distribuição prioriza quem tem menos peso na carteira
    if (config.distribuicao === 'menor_peso') {
      const atuais = selecionados.map((item) => {
        const posicao = carteira.posicoes.get(item.ativoId)
        return (posicao?.quantidade ?? 0) * item.preco
      })
      const alvo = (atuais.reduce((sum, valor) => sum + valor, 0) + caixa) / n
      const faltas = atuais.map((valor) => Math.max(alvo - valor, 0))
      const totalFalta = faltas.reduce((sum, valor) => sum + valor, 0)
      if (totalFalta > 0) {
        return faltas.map((falta) => (caixa * falta) / totalFalta)
      }
    }

    // Presume partes iguais (distribuição `igual` ou sem falta a cobrir)
    return selecionados.map(() => caixa / n)
  }

  /** Provisiona os proventos das posições com data-com aceita pelo filtro */
  private provisionar(
    carteira: Portfolio,
    aceita: (dataCom: IsoDate) => boolean,
  ) {
    for (const posicao of carteira.posicoes.values()) {
      for (const provento of this.provider.proventos(posicao.ativoId)) {
        if (aceita(provento.dataCom)) {
          carteira.provisionarProvento(
            posicao.ativoId,
            provento.dataCom,
            provento.dataPagamento,
            provento.valor,
            provento.fonte,
          )
        }
      }
    }
  }

  /** Calcula as métricas, os retornos futuros e a análise por faixa */
  private montarResultado(
    config: BacktestConfigResolvida,
    scorer: Scorer<TSnapshot>,
    benchmark: Benchmark,
    carteira: Portfolio,
    recomendacoes: Recomendacao[],
    pontos: PontoCarteira[],
    avisos: string[],
  ): ResultadoBacktest {
    const provider = this.provider
    const pregoes = provider.pregoes()
    const ultimaData = pregoes[pregoes.length - 1]

    // Calcula as métricas da estratégia e do benchmark
    const serie = (benchmarkSerie: boolean): SerieCarteira => ({
      datas: pontos.map((p) => p.data),
      cotas: pontos.map((p) => (benchmarkSerie ? p.benchmarkCota : p.cota)),
      patrimonio: pontos.map((p) =>
        benchmarkSerie ? p.benchmarkPatrimonio : p.patrimonio,
      ),
      aportado: pontos.map((p) => p.aportado),
      cdi: pontos.map((p) => p.cdiDia),
    })
    const estrategia = calcularMetricas(serie(false))
    const metricasBenchmark = calcularMetricas(serie(true))
    const dividendosTotais =
      carteira.dividendosRecebidos + carteira.proventosAReceber

    // Calcula o retorno depois de cada recomendação (e, nas compradas, até o
    // fim da simulação)
    const observacoes: ObservacaoScore[] = []
    const analisadas = recomendacoes.map((recomendacao) => {
      const precoBase =
        recomendacao.precoCompra ??
        provider.precoNoDia(recomendacao.ativoId, recomendacao.data) ??
        recomendacao.precoReferencia
      const retornos = retornosFuturos(
        provider,
        recomendacao.ativoId,
        recomendacao.data,
        precoBase,
        config.horizontes,
        ultimaData,
      )
      for (const retorno of retornos) {
        observacoes.push({
          data: recomendacao.data,
          score: recomendacao.score,
          horizonte: retorno.horizonte ?? 0,
          retornoTotal: retorno.retornoTotal,
        })
      }
      if (recomendacao.selecionado && recomendacao.quantidade > 0) {
        const ateFim = retornoEntre(
          provider,
          recomendacao.ativoId,
          recomendacao.data,
          precoBase,
          config.fim,
          null,
        )
        if (ateFim) {
          retornos.push(ateFim)
        }
      }
      return { ...recomendacao, retornos }
    })

    // Monta as posições finais
    const posicoesFinais = [...carteira.posicoes.values()].map((posicao) => {
      const preco =
        provider.ultimoPrecoAte(posicao.ativoId, config.fim)?.fechamento ?? 0
      return {
        ativoId: posicao.ativoId,
        ticker: posicao.ticker,
        quantidade: posicao.quantidade,
        precoMedio: posicao.custoTotal / posicao.quantidade,
        preco,
        valor: posicao.quantidade * preco,
      }
    })

    return {
      id: crypto.randomUUID(),
      criadoEm: new Date().toISOString(),
      tipoAtivo: provider.tipoAtivo,
      scoreVersao: scorer.versao,
      scoreDescricao: scorer.descricao,
      benchmarkNome: benchmark.nome,
      dadosVersao: this.versaoDados(),
      codigoVersao: versaoCodigo(),
      scoreConfig: {
        coberturaMinima: scorer.coberturaMinima,
        criterios: scorer.criteriosConfig,
      },
      config,
      resumo: {
        estrategia: {
          ...estrategia,
          valorizacao:
            estrategia.patrimonioFinal -
            estrategia.aportado -
            dividendosTotais +
            carteira.irPago +
            carteira.custos,
          dividendosRecebidos: dividendosTotais,
          dividendosReinvestidos: config.reinvestirDividendos
            ? carteira.dividendosRecebidos
            : 0,
          irPago: carteira.irPago,
          custos: carteira.custos,
        },
        benchmark: metricasBenchmark,
        excessoCagr:
          estrategia.cagr !== null && metricasBenchmark.cagr !== null
            ? estrategia.cagr - metricasBenchmark.cagr
            : null,
        excessoPatrimonio:
          estrategia.patrimonioFinal - metricasBenchmark.patrimonioFinal,
      },
      recomendacoes: analisadas,
      operacoes: carteira.operacoes,
      dividendos: carteira.dividendos,
      carteira: pontos,
      faixas: analisarFaixas(observacoes),
      posicoesFinais,
      avisos,
    }
  }
}
