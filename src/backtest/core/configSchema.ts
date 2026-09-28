import { z } from 'zod'

import type { BacktestConfig } from './types.js'

const data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD')

/**
 * Schema da configuração da simulação
 *
 * Objetos estritos: um campo digitado errado vira erro, em vez de ser
 * ignorado. É a referência dos campos aceitos (ver também `types.ts`)
 */
export const configSchema = z.strictObject({
  nome: z.string().optional(),
  inicio: data.optional(),
  fim: data.optional(),
  anos: z.number().positive().max(50).optional(),
  saldoInicial: z.number().min(0).optional(),
  cotasIniciais: z
    .array(
      z.strictObject({
        ticker: z.string().min(1),
        quantidade: z.number().int().positive(),
      }),
    )
    .optional(),
  aporte: z.strictObject({
    valor: z.number().min(0),
    frequencia: z.enum(['diaria', 'semanal', 'mensal']),
    dia: z.number().int().min(1).max(31).optional(),
  }),
  selecao: z.strictObject({
    quantidade: z.number().int().positive(),
    scoreMinimo: z.number().min(0).max(100).optional(),
    liquidezMinima: z.number().min(0).optional(),
    tickers: z.array(z.string().min(1)).optional(),
  }),
  distribuicao: z.enum(['igual', 'proporcional_score', 'menor_peso']),
  reinvestirDividendos: z.boolean(),
  rebalanceamento: z.strictObject({
    frequencia: z.enum([
      'nenhum',
      'mensal',
      'trimestral',
      'semestral',
      'anual',
    ]),
  }),
  benchmark: z.discriminatedUnion('tipo', [
    z.strictObject({ tipo: z.literal('cdi') }),
    z.strictObject({ tipo: z.literal('universo') }),
    z.strictObject({ tipo: z.literal('ativo'), ticker: z.string().min(1) }),
  ]),
  score: z.string().min(1),
  fracionado: z.boolean().optional(),
  aliquotaIr: z.number().min(0).max(1).optional(),
  custoOperacao: z.number().min(0).max(0.1).optional(),
  horizontes: z.array(z.number().int().positive()).optional(),
})

/**
 * Valida a configuração da simulação
 *
 * @throws Error com a lista legível dos problemas encontrados
 */
export function validarConfig(entrada: unknown): BacktestConfig {
  const resultado = configSchema.safeParse(entrada)
  // Se a configuração é inválida
  if (!resultado.success) {
    throw new Error(
      `configuração inválida:\n${z.prettifyError(resultado.error)}`,
    )
  }
  return resultado.data
}
