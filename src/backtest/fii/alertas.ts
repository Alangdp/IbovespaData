import type { FiiSnapshot } from './FiiHistoricalProvider.js'

/** Gravidade de um alerta */
export type Severidade = 'atencao' | 'risco'

/** Sinal que merece olhar antes de comprar */
export interface Alerta {
  codigo: string
  severidade: Severidade
  mensagem: string
}

/**
 * Limites dos alertas de FII, num lugar só para calibrar
 *
 * Os alertas não entram no score: são avisos para quem decide e colunas do
 * dataset (a IA pode aprender se eles importam)
 */
export const LIMITES_ALERTA = {
  /** DY 12m acima disto costuma ser rendimento extraordinário ou fundo em crise (%) */
  dyMuitoAlto: 16,
  /** DY 12m abaixo disto (%) */
  dyBaixo: 4,
  /** P/VP abaixo disto: desconto grande pode ser sinal de problema no ativo */
  pvpMuitoBaixo: 0.7,
  /** P/VP acima disto */
  pvpAlto: 1.3,
  /** Alavancagem acima disto (% do ativo) */
  alavancagemAlta: 20,
  /** Emissão de cotas em 12 meses acima disto (%) */
  emissaoAlta: 30,
  /** Vacância acima disto (%) */
  vacanciaAlta: 15,
  /** Dias desde a entrega do informe mensal acima disto */
  informeAtrasado: 75,
  /** Liquidez média diária abaixo disto (R$) */
  liquidezBaixa: 200_000,
  /** Queda desde o topo de 12 meses maior que isto (%) */
  quedaForte: -25,
  /** Queda dos rendimentos (6m contra 6m) maior que isto (%) */
  dividendosEmQueda: -20,
}

/** Lista os alertas do fundo na data do snapshot */
export function alertasFii(s: FiiSnapshot): Alerta[] {
  const L = LIMITES_ALERTA
  const alertas: Alerta[] = []
  const adicionar = (
    condicao: boolean,
    codigo: string,
    severidade: Severidade,
    mensagem: string,
  ) => {
    if (condicao) {
      alertas.push({ codigo, severidade, mensagem })
    }
  }

  adicionar(
    s.dy12m !== null && s.dy12m > L.dyMuitoAlto,
    'dy_muito_alto',
    'risco',
    `DY 12m de ${s.dy12m}%: acima de ${L.dyMuitoAlto}% costuma ser rendimento extraordinário ou preço em queda`,
  )
  adicionar(
    s.dy12m !== null && s.dy12m < L.dyBaixo,
    'dy_baixo',
    'atencao',
    `DY 12m de ${s.dy12m}%, abaixo de ${L.dyBaixo}%`,
  )
  adicionar(
    s.pvp !== null && s.pvp < L.pvpMuitoBaixo,
    'pvp_muito_baixo',
    'atencao',
    `P/VP de ${s.pvp}: desconto grande pode indicar problema nos ativos ou avaliação desatualizada`,
  )
  adicionar(
    s.pvp !== null && s.pvp > L.pvpAlto,
    'pvp_alto',
    'atencao',
    `P/VP de ${s.pvp}, acima de ${L.pvpAlto}`,
  )
  adicionar(
    s.alavancagem !== null && s.alavancagem > L.alavancagemAlta,
    'alavancagem_alta',
    'risco',
    `alavancagem de ${s.alavancagem}% do ativo`,
  )
  adicionar(
    s.emissao12m !== null && s.emissao12m > L.emissaoAlta,
    'emissao_recente',
    'atencao',
    `cotas aumentaram ${s.emissao12m}% em 12 meses por emissões (diluição, rendimento pode cair)`,
  )
  adicionar(
    s.vacancia !== null && s.vacancia > L.vacanciaAlta,
    'vacancia_alta',
    'risco',
    `vacância de ${s.vacancia}%`,
  )
  adicionar(
    s.limiteDistribuicao === false,
    'distribuicao_abaixo_95',
    'risco',
    'distribuiu menos de 95% do resultado do último semestre',
  )
  adicionar(
    s.fonteProventos === 'cvm_estimado',
    'proventos_estimados',
    'atencao',
    'proventos estimados pelo informe da CVM (o statusinvest não tem o fundo)',
  )
  adicionar(
    s.diasDesdeInforme !== null && s.diasDesdeInforme > L.informeAtrasado,
    'informe_atrasado',
    'atencao',
    `último informe mensal entregue há ${s.diasDesdeInforme} dias`,
  )
  adicionar(
    s.cnpj !== null && s.informeMensal === null,
    'sem_informe',
    'risco',
    'sem informe mensal recente na CVM: fundamentos indisponíveis',
  )
  adicionar(
    s.liquidezMedia < L.liquidezBaixa,
    'baixa_liquidez',
    'atencao',
    `liquidez média de R$ ${Math.round(s.liquidezMedia).toLocaleString('pt-BR')} por dia`,
  )
  adicionar(
    s.quedaDoTopo12m !== null && s.quedaDoTopo12m < L.quedaForte,
    'queda_forte',
    'atencao',
    `cota ${s.quedaDoTopo12m}% abaixo do topo de 12 meses`,
  )
  adicionar(
    s.crescimentoDividendos !== null &&
      s.crescimentoDividendos < L.dividendosEmQueda,
    'dividendos_em_queda',
    'risco',
    `rendimentos dos últimos 6 meses ${s.crescimentoDividendos}% em relação aos 6 anteriores`,
  )
  adicionar(
    s.amortizacao12m !== null && s.amortizacao12m > 0,
    'amortizacao',
    'atencao',
    `amortizou ${s.amortizacao12m}% do preço em 12 meses (devolução de capital, não é rendimento)`,
  )
  return alertas
}
