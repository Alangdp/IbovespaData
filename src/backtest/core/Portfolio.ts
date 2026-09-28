import type {
  DividendoRecebido,
  IsoDate,
  Operacao,
  TipoOperacao,
} from './types.js'

/** Posição em um ativo */
export interface Posicao {
  ativoId: string
  ticker: string
  quantidade: number
  /** Custo total das cotas em carteira, para o preço médio (R$) */
  custoTotal: number
}

/** Custos e regras das operações */
export interface RegrasOperacao {
  fracionado: boolean
  /** Fração do valor de cada operação */
  custoOperacao: number
  /** Alíquota de IR sobre o lucro das vendas */
  aliquotaIr: number
}

/** Arredonda para centavos */
function centavos(valor: number): number {
  return Math.round(valor * 100) / 100
}

/**
 * Carteira simulada
 *
 * O caixa fica em dois saldos: o `caixa`, que entra nos aportes, e os
 * `dividendosParados`, que só entram quando os dividendos não são
 * reinvestidos (continuam no patrimônio, mas fora das compras)
 */
export class Portfolio {
  readonly posicoes = new Map<string, Posicao>()
  readonly operacoes: Operacao[] = []
  readonly dividendos: DividendoRecebido[] = []
  /** Proventos com data-com já passada e pagamento por vir */
  private readonly pendentes: DividendoRecebido[] = []

  caixa = 0
  dividendosParados = 0
  aportado = 0
  irPago = 0
  custos = 0
  /** Lucro realizado nas vendas (antes do IR) */
  lucroRealizado = 0
  /** Prejuízo de vendas a compensar nos próximos lucros */
  private prejuizoAcumulado = 0

  constructor(
    private readonly regras: RegrasOperacao,
    private readonly reinvestirDividendos: boolean,
  ) {}

  /** Adiciona um aporte ao caixa */
  aportar(valor: number) {
    this.aportado += valor
    this.caixa += valor
  }

  /**
   * Inclui cotas que a carteira já tem no início: o valor delas ao preço
   * dado conta como aportado e vira o custo (sem custo de operação)
   */
  incluirPosicao(
    data: IsoDate,
    ativoId: string,
    ticker: string,
    quantidade: number,
    preco: number,
  ) {
    const valor = quantidade * preco
    this.aportado += valor
    const posicao = this.posicoes.get(ativoId) ?? {
      ativoId,
      ticker,
      quantidade: 0,
      custoTotal: 0,
    }
    posicao.quantidade += quantidade
    posicao.custoTotal += valor
    this.posicoes.set(ativoId, posicao)

    this.registrar(
      data,
      posicao,
      'posicao_inicial',
      quantidade,
      preco,
      valor,
      0,
      0,
      'cotas iniciais',
    )
  }

  /**
   * Compra o máximo de cotas com o valor, ao preço dado
   *
   * @returns A quantidade comprada (0 se o valor não paga uma cota)
   */
  comprar(
    data: IsoDate,
    ativoId: string,
    ticker: string,
    valor: number,
    preco: number,
  ): number {
    const disponivel = Math.min(valor, this.caixa)
    const precoComCusto = preco * (1 + this.regras.custoOperacao)
    const quantidade = this.regras.fracionado
      ? disponivel / precoComCusto
      : Math.floor(disponivel / precoComCusto)
    // Se o valor não compra nenhuma cota
    if (quantidade <= 0) {
      return 0
    }

    // Atualiza o caixa e a posição
    const bruto = quantidade * preco
    const custo = bruto * this.regras.custoOperacao
    this.caixa -= bruto + custo
    this.custos += custo
    const posicao = this.posicoes.get(ativoId) ?? {
      ativoId,
      ticker,
      quantidade: 0,
      custoTotal: 0,
    }
    posicao.ticker = ticker
    posicao.quantidade += quantidade
    posicao.custoTotal += bruto + custo
    this.posicoes.set(ativoId, posicao)

    this.registrar(data, posicao, 'compra', quantidade, preco, bruto, custo, 0)
    return quantidade
  }

  /**
   * Vende a quantidade (ou a posição inteira), pagando IR sobre o lucro
   * depois de compensar o prejuízo acumulado
   */
  vender(
    data: IsoDate,
    ativoId: string,
    preco: number,
    motivo: string,
    tipo: TipoOperacao = 'venda',
    quantidade?: number,
  ) {
    const posicao = this.posicoes.get(ativoId)
    // Se a carteira não tem o ativo
    if (!posicao || posicao.quantidade <= 0) {
      return
    }

    // Calcula o valor, o custo e o lucro da venda
    const vendida = Math.min(
      quantidade ?? posicao.quantidade,
      posicao.quantidade,
    )
    const bruto = vendida * preco
    const custo = bruto * this.regras.custoOperacao
    const custoMedio = (posicao.custoTotal / posicao.quantidade) * vendida
    const lucro = bruto - custo - custoMedio
    this.lucroRealizado += lucro

    // Compensa o prejuízo acumulado antes de calcular o IR
    let ir = 0
    if (lucro < 0) {
      this.prejuizoAcumulado += -lucro
    } else {
      const compensado = Math.min(lucro, this.prejuizoAcumulado)
      this.prejuizoAcumulado -= compensado
      ir = centavos((lucro - compensado) * this.regras.aliquotaIr)
    }

    // Atualiza o caixa e a posição
    this.caixa += bruto - custo - ir
    this.custos += custo
    this.irPago += ir
    posicao.quantidade -= vendida
    posicao.custoTotal -= custoMedio
    if (posicao.quantidade <= 1e-9) {
      this.posicoes.delete(ativoId)
    }

    this.registrar(
      data,
      posicao,
      tipo,
      vendida,
      preco,
      bruto,
      custo,
      ir,
      motivo,
    )
  }

  /**
   * Aplica um desdobramento (fator > 1) ou grupamento (fator < 1): a
   * quantidade muda e o custo total fica igual; no grupamento a fração que
   * sobra é vendida ao preço do dia
   */
  desdobrar(data: IsoDate, ativoId: string, fator: number, preco: number) {
    const posicao = this.posicoes.get(ativoId)
    // Se a carteira não tem o ativo
    if (!posicao) {
      return
    }

    const nova = posicao.quantidade * fator
    const inteira = this.regras.fracionado ? nova : Math.floor(nova + 1e-9)
    const tipo = fator > 1 ? 'desdobramento' : 'grupamento'
    this.registrar(
      data,
      posicao,
      tipo,
      inteira - posicao.quantidade,
      preco,
      0,
      0,
      0,
      `fator ${fator}`,
    )
    posicao.quantidade = nova

    // Se o grupamento deixou fração de cota, vende a fração (os proventos
    // pendentes não mudam: já estão em R$)
    if (inteira < nova) {
      this.vender(
        data,
        ativoId,
        preco,
        'fração do grupamento',
        'venda',
        nova - inteira,
      )
    }
  }

  /**
   * Registra o direito aos proventos: a carteira tinha a cota na data-com e
   * recebe na data de pagamento
   */
  provisionarProvento(
    ativoId: string,
    dataCom: IsoDate,
    dataPagamento: IsoDate,
    valorPorCota: number,
    fonte: string,
  ) {
    const posicao = this.posicoes.get(ativoId)
    // Se a carteira não tinha o ativo na data-com
    if (!posicao || posicao.quantidade <= 0) {
      return
    }
    this.pendentes.push({
      dataCom,
      dataPagamento,
      ativoId,
      ticker: posicao.ticker,
      quantidade: posicao.quantidade,
      valorPorCota,
      total: centavos(posicao.quantidade * valorPorCota),
      fonte,
    })
  }

  /** Recebe os proventos com pagamento até a data */
  receberProventos(data: IsoDate) {
    for (let i = this.pendentes.length - 1; i >= 0; i--) {
      const provento = this.pendentes[i]
      // Se o pagamento ainda não chegou
      if (provento.dataPagamento > data) {
        continue
      }
      this.pendentes.splice(i, 1)
      this.dividendos.push(provento)
      if (this.reinvestirDividendos) {
        this.caixa += provento.total
      } else {
        this.dividendosParados += provento.total
      }
    }
  }

  /** Total a receber dos proventos já provisionados (R$) */
  get proventosAReceber(): number {
    return this.pendentes.reduce((sum, provento) => sum + provento.total, 0)
  }

  /** Total de dividendos recebidos (R$) */
  get dividendosRecebidos(): number {
    return this.dividendos.reduce((sum, provento) => sum + provento.total, 0)
  }

  /**
   * Valor das posições ao preço de cada ativo
   *
   * @param preco - Último preço conhecido do ativo
   */
  valorPosicoes(preco: (ativoId: string) => number | null): number {
    let total = 0
    for (const posicao of this.posicoes.values()) {
      total += posicao.quantidade * (preco(posicao.ativoId) ?? 0)
    }
    return total
  }

  /** Registra a operação no histórico */
  private registrar(
    data: IsoDate,
    posicao: Posicao,
    tipo: TipoOperacao,
    quantidade: number,
    preco: number,
    valor: number,
    custo: number,
    ir: number,
    motivo?: string,
  ) {
    this.operacoes.push({
      data,
      ativoId: posicao.ativoId,
      ticker: posicao.ticker,
      tipo,
      quantidade,
      preco,
      valor: centavos(valor),
      custo: centavos(custo),
      ir,
      ...(motivo ? { motivo } : {}),
    })
  }
}
