import axios from 'axios'

import { addDays, addMonths, brToIso, daysBetween } from '../core/dates.js'
import { fetchSgsAno } from './bcb.js'
import type { MacroLinha, MarketDatabase } from './MarketDatabase.js'

/**
 * Séries macroeconômicas do backtest
 *
 * Cada valor é gravado com `conhecidoEm`, a data em que ele passou a ser
 * público: a simulação numa data D só enxerga valores conhecidos antes de D
 */
export const SERIES_MACRO = {
  /** Meta da Selic (% ao ano), BCB SGS 432; vale no próprio dia */
  selic_meta: { descricao: 'Meta da Selic (% a.a.)', sgs: 432 },
  /** IPCA do mês (%), BCB SGS 433; o IBGE divulga por volta do dia 10 do mês seguinte */
  ipca_mes: { descricao: 'IPCA do mês (%)', sgs: 433 },
  /** IPCA acumulado em 12 meses (%), BCB SGS 13522; mesma divulgação do mensal */
  ipca_12m: { descricao: 'IPCA acumulado em 12 meses (%)', sgs: 13522 },
  /**
   * Juro real da NTN-B (Tesouro IPCA+ com juros semestrais) com vencimento
   * mais próximo de 10 anos (% ao ano), taxa de compra da manhã do Tesouro
   * Direto; vale no próprio dia
   */
  ntnb_10a: { descricao: 'Juro real da NTN-B de ~10 anos (% a.a.)', sgs: null },
} as const

/** Nome de uma série macro */
export type SerieMacro = keyof typeof SERIES_MACRO

/**
 * Dias depois do mês de referência para o IPCA ser conhecido: o IBGE divulga
 * entre os dias 8 e 12 do mês seguinte; 15 dá folga
 */
const DIAS_DIVULGACAO_IPCA = 15

/** Histórico de preços e taxas do Tesouro Direto (Tesouro Transparente) */
const TESOURO_DIRETO_URL =
  'https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv'

/** Título usado no juro real (NTN-B) */
const TITULO_NTNB = 'Tesouro IPCA+ com Juros Semestrais'

/** Prazo alvo do juro real, em dias */
const PRAZO_NTNB_DIAS = 3652

/**
 * Lê o CSV do Tesouro Direto e escolhe, em cada dia, a NTN-B com vencimento
 * mais próximo de 10 anos
 *
 * @param csv - Conteúdo do arquivo (`;`, decimal com vírgula, datas dd/mm/aaaa)
 */
export function parseNtnb(csv: string): MacroLinha[] {
  const melhores = new Map<string, { distancia: number; taxa: number }>()
  for (const linha of csv.split(/\r?\n/).slice(1)) {
    const [titulo, vencimentoBr, baseBr, taxaTexto] = linha.split(';')
    // Se a linha não é de NTN-B
    if (titulo !== TITULO_NTNB) {
      continue
    }
    const vencimento = brToIso(vencimentoBr)
    const base = brToIso(baseBr)
    const taxa = Number(taxaTexto?.replace(',', '.'))
    // Se falta data ou taxa
    if (!vencimento || !base || !Number.isFinite(taxa) || taxa === 0) {
      continue
    }

    // Guarda o título mais perto do prazo alvo em cada dia
    const distancia = Math.abs(daysBetween(base, vencimento) - PRAZO_NTNB_DIAS)
    const atual = melhores.get(base)
    if (!atual || distancia < atual.distancia) {
      melhores.set(base, { distancia, taxa })
    }
  }

  return [...melhores.entries()].map(([data, { taxa }]) => ({
    serie: 'ntnb_10a',
    data,
    valor: taxa,
    conhecidoEm: data,
  }))
}

/**
 * Converte os dados do SGS para linhas macro, com a data de divulgação
 *
 * Séries mensais (IPCA) vêm com a data do 1º dia do mês de referência e só
 * são conhecidas depois da divulgação
 */
export function linhasSgs(
  serie: SerieMacro,
  dados: { data: string; valor: number }[],
): MacroLinha[] {
  const mensal = serie === 'ipca_mes' || serie === 'ipca_12m'
  return dados.map((item) => ({
    serie,
    data: item.data,
    valor: item.valor,
    conhecidoEm: mensal
      ? addDays(addMonths(item.data, 1), DIAS_DIVULGACAO_IPCA - 1)
      : item.data,
  }))
}

/**
 * Baixa as séries macro (Selic, IPCA e juro real da NTN-B)
 *
 * Anos fechados já baixados são pulados; o ano corrente e o Tesouro Direto
 * (arquivo único) são baixados no máximo 1x por dia
 */
export async function ingerirMacro(
  db: MarketDatabase,
  anos: number[],
  log: (mensagem: string) => void,
  force = false,
) {
  const anoAtual = new Date().getFullYear()
  const hoje = new Date().toISOString().slice(0, 10)

  // Baixa as séries do Banco Central, ano a ano
  for (const [serie, config] of Object.entries(SERIES_MACRO)) {
    if (config.sgs === null) {
      continue
    }
    for (const ano of anos) {
      const chave = `macro-${serie}-${ano}`
      const baixado = db.lerControle(chave) !== null
      // Se o ano já foi baixado (fechado, ou o corrente hoje)
      if (!force && baixado && (ano < anoAtual || db.atualizadoHoje(chave))) {
        continue
      }
      // A série da Selic meta vem com datas futuras (vigência): corta em hoje
      const dados = (await fetchSgsAno(config.sgs, ano)).filter(
        (item) => item.data <= hoje,
      )
      db.inserirMacro(linhasSgs(serie as SerieMacro, dados))
      db.gravarControle(chave, String(dados.length))
    }
    log(`macro ${serie}: ok`)
  }

  // Baixa o juro real da NTN-B (um arquivo com todo o histórico)
  const chave = 'macro-ntnb_10a'
  if (force || !db.atualizadoHoje(chave)) {
    const { data } = await axios.get<string>(TESOURO_DIRETO_URL, {
      responseType: 'text',
      timeout: 300_000,
    })
    const linhas = parseNtnb(data)
    db.inserirMacro(linhas)
    db.gravarControle(chave, String(linhas.length))
    log(`macro ntnb_10a: ${linhas.length} dias`)
  }
}
