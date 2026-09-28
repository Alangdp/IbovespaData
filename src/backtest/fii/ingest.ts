import { type CvmRow, cnpjDigits } from '../../sources/cvm/build.js'
import { parseCsv } from '../../sources/cvm/csv.js'
import {
  type CvmInforme,
  fetchCvmCsvs,
  fetchCvmEtag,
} from '../../sources/cvm/download.js'
import { statusInvestApi } from '../../sources/statusinvest/http.js'
import type { RootDividend } from '../../types/dividends.type.js'
import { addDays, brToIso, endOfMonth } from '../core/dates.js'
import { baixarCotahist } from '../data/b3Cotahist.js'
import { fetchCdiAno } from '../data/bcb.js'
import type {
  CvmLinha,
  EventoLinha,
  MarketDatabase,
  ProventoLinha,
} from '../data/MarketDatabase.js'

/** Código BDI dos FIIs no COTAHIST */
export const CODBDI_FII = '12'

/** Fonte dos proventos do statusinvest */
export const FONTE_STATUSINVEST = 'statusinvest'

/** Fonte dos proventos estimados pelo informe mensal */
export const FONTE_CVM_ESTIMADO = 'cvm_estimado'

/** Fonte dos desdobramentos detectados */
export const FONTE_DETECTADO = 'detectado'

/** Primeiro ano com informes da CVM */
export const PRIMEIRO_ANO_CVM = 2016

/**
 * Versão da lista de colunas guardadas da CVM: aumente ao incluir uma coluna,
 * para os anos já baixados serem baixados de novo
 */
const VERSAO_COLUNAS_CVM = 3

/**
 * Colunas guardadas de cada CSV da CVM (o resto não é usado e só ocuparia
 * espaço); `geral` também dá a data de entrega de cada informe
 */
const CVM_COLUNAS: Record<string, { informe: CvmInforme; colunas: string[] }> =
  {
    inf_mensal_fii_geral: {
      informe: 'mensal',
      colunas: [
        'Nome_Fundo_Classe',
        'Data_Funcionamento',
        'Codigo_ISIN',
        'Segmento_Atuacao',
        'Mandato',
        'Tipo_Gestao',
        'Quantidade_Cotas_Emitidas',
      ],
    },
    inf_mensal_fii_complemento: {
      informe: 'mensal',
      colunas: [
        'Total_Numero_Cotistas',
        'Valor_Ativo',
        'Patrimonio_Liquido',
        'Cotas_Emitidas',
        'Valor_Patrimonial_Cotas',
        'Percentual_Dividend_Yield_Mes',
      ],
    },
    inf_mensal_fii_ativo_passivo: {
      informe: 'mensal',
      colunas: [
        'Disponibilidades',
        'Total_Necessidades_Liquidez',
        'Direitos_Bens_Imoveis',
        'Acoes_Sociedades_Atividades_FII',
        'Cotas_Sociedades_Atividades_FII',
        'CRI',
        'CRI_CRA',
        'FII',
        'Obrigacoes_Securitizacao_Recebiveis',
        'Obrigacoes_Aquisicao_Imoveis',
      ],
    },
    inf_trimestral_fii_geral: { informe: 'trimestral', colunas: [] },
    inf_trimestral_fii_resultado_contabil_financeiro: {
      informe: 'trimestral',
      colunas: [
        'Taxa_Administracao_Financeiro',
        'Taxa_Administracao_Contabil',
        'Resultado_Financeiro_Liquido_Acumulado',
        'Resultado_Financeiro_Liquido_Acumulado_95',
        'Rendimentos_Declarados',
      ],
    },
    inf_trimestral_fii_imovel: {
      informe: 'trimestral',
      colunas: [
        'Classe',
        'Nome_Imovel',
        'Endereco',
        'Area',
        'Percentual_Vacancia',
        'Percentual_Receitas_FII',
      ],
    },
    inf_trimestral_fii_ativo: {
      informe: 'trimestral',
      colunas: ['Tipo', 'Valor'],
    },
  }

/**
 * Prazo presumido de entrega quando o informe não tem `Data_Entrega`
 * (conservador: a CVM dá 15 dias após o mês e 30 após o trimestre, mas
 * atrasos são comuns)
 */
const ENTREGA_PRESUMIDA: Record<CvmInforme, number> = {
  mensal: 75,
  trimestral: 90,
  anual: 120,
}

/**
 * Nomes antigos das colunas da CVM (até 2021, antes das classes de fundo da
 * Resolução 175) e o nome atual
 */
const COLUNAS_ANTIGAS: Record<string, string> = {
  CNPJ_Fundo: 'CNPJ_Fundo_Classe',
  Nome_Fundo: 'Nome_Fundo_Classe',
}

/** Lê o CSV da CVM trocando os nomes antigos das colunas pelos atuais */
export function parseCsvCvm(texto: string): CvmRow[] {
  return parseCsv(texto).map((row) => {
    for (const [antiga, atual] of Object.entries(COLUNAS_ANTIGAS)) {
      if (antiga in row && !(atual in row)) {
        row[atual] = row[antiga]
        delete row[antiga]
      }
    }
    return row
  })
}

/** Mostra o progresso da ingestão */
type Log = (mensagem: string) => void

/** Ano corrente (os arquivos do ano ainda mudam) */
function anoAtual(): number {
  return new Date().getFullYear()
}

/**
 * Verifica se o ano pode ser pulado: ano fechado já baixado, ou ano corrente
 * já baixado hoje
 */
function jaBaixado(db: MarketDatabase, chave: string, ano: number): boolean {
  // Se o ano nunca foi baixado
  if (!db.lerControle(chave)) {
    return false
  }
  return ano < anoAtual() || db.atualizadoHoje(chave)
}

/**
 * Carrega os FIIs da base, todos ou só os dos tickers informados
 *
 * @param tickers - Tickers pedidos; vazio ou ausente = todos
 */
export function ativosFii(
  db: MarketDatabase,
  tickers?: string[],
): { ativo_id: string; ticker: string }[] {
  const ativos = db.db
    .prepare(
      'SELECT ativo_id, ticker FROM ativo WHERE codbdi = ? ORDER BY ticker',
    )
    .all(CODBDI_FII) as { ativo_id: string; ticker: string }[]
  // Se não há filtro de tickers
  if (!tickers?.length) {
    return ativos
  }
  const pedidos = new Set(tickers.map((ticker) => ticker.toUpperCase()))
  return ativos.filter((ativo) => pedidos.has(ativo.ticker))
}

/**
 * Baixa as cotações dos FIIs (e dos tickers extras, como ETFs usados de
 * benchmark) do COTAHIST de cada ano
 *
 * A B3 só publica o arquivo do ano inteiro (todos os ativos), então não há
 * como baixar só um fundo. Anos fechados já baixados são pulados, e o ano
 * corrente também, se já foi baixado hoje
 */
export async function ingerirCotacoes(
  db: MarketDatabase,
  anos: number[],
  extras: string[],
  log: Log,
  force = false,
) {
  const tickersExtras = new Set(extras.map((ticker) => ticker.toUpperCase()))
  for (const ano of anos) {
    const chave = `cotahist-${ano}`
    // Se o ano já foi baixado
    if (!force && jaBaixado(db, chave, ano)) {
      continue
    }
    log(`COTAHIST ${ano}: baixando`)
    const total = await baixarCotahist(
      ano,
      (linha) =>
        linha.especi === 'CI' &&
        (linha.codbdi === CODBDI_FII || tickersExtras.has(linha.ticker)),
      (lote) => db.inserirPrecos(lote),
    )
    db.gravarControle(chave, String(total))
    log(`COTAHIST ${ano}: ${total} cotações`)
  }
}

/**
 * Baixa os informes mensais e trimestrais da CVM de cada ano e grava as
 * linhas com a data de entrega do informe (a versão reapresentada tem a sua
 * própria data de entrega)
 *
 * Anos sem mudança no arquivo (mesmo ETag) são pulados
 */
export async function ingerirCvm(
  db: MarketDatabase,
  anos: number[],
  log: Log,
  force = false,
) {
  for (const ano of anos.filter((ano) => ano >= PRIMEIRO_ANO_CVM)) {
    for (const informe of ['mensal', 'trimestral'] as const) {
      // Verifica se o arquivo mudou desde a última ingestão
      const chave = `cvm-${informe}-${ano}-v${VERSAO_COLUNAS_CVM}`
      const etag = await fetchCvmEtag(informe, ano)
      // Se o arquivo não existe ou não mudou
      if (etag === null || (!force && db.lerControle(chave) === etag)) {
        continue
      }

      log(`CVM ${informe} ${ano}: baixando`)
      const arquivos = Object.entries(CVM_COLUNAS)
        .filter(([, config]) => config.informe === informe)
        .map(([arquivo]) => arquivo)
      const csvs = await fetchCvmCsvs(informe, ano, arquivos)

      // Carrega a data de entrega de cada informe e versão
      const geral = parseCsvCvm(csvs[`inf_${informe}_fii_geral`] ?? '')
      const entregas = new Map<string, string>()
      for (const row of geral) {
        const entrega = row.Data_Entrega?.trim()
        if (entrega) {
          entregas.set(
            `${cnpjDigits(row.CNPJ_Fundo_Classe)}|${row.Data_Referencia}|${Number(row.Versao)}`,
            entrega,
          )
        }
      }

      // Grava as linhas de cada arquivo com as colunas usadas
      for (const arquivo of arquivos) {
        const colunas = CVM_COLUNAS[arquivo].colunas
        const linhas: CvmLinha[] = parseCsvCvm(csvs[arquivo] ?? '').map(
          (row) => {
            const cnpj = cnpjDigits(row.CNPJ_Fundo_Classe)
            const versao = Number(row.Versao) || 1
            const referencia = row.Data_Referencia
            return {
              cnpj,
              arquivo,
              dataReferencia: referencia,
              versao,
              dataEntrega:
                entregas.get(`${cnpj}|${referencia}|${versao}`) ??
                addDays(referencia, ENTREGA_PRESUMIDA[informe]),
              dados: Object.fromEntries(
                [
                  'CNPJ_Fundo_Classe',
                  'Data_Referencia',
                  'Versao',
                  ...colunas,
                ].map((coluna) => [coluna, row[coluna] ?? '']),
              ),
            }
          },
        )
        db.substituirCvm(arquivo, ano, linhas)
        log(`CVM ${arquivo} ${ano}: ${linhas.length} linhas`)
      }
      db.gravarControle(chave, etag)
    }
  }
}

/** Baixa o CDI diário de cada ano */
export async function ingerirCdi(
  db: MarketDatabase,
  anos: number[],
  log: Log,
  force = false,
) {
  for (const ano of anos) {
    const chave = `cdi-${ano}`
    // Se o ano já foi baixado
    if (!force && jaBaixado(db, chave, ano)) {
      continue
    }
    const taxas = await fetchCdiAno(ano)
    db.inserirCdi(taxas)
    db.gravarControle(chave, String(taxas.length))
    log(`CDI ${ano}: ${taxas.length} dias`)
  }
}

/**
 * Converte os proventos do statusinvest para a base de cotas da data-com
 *
 * O statusinvest devolve o valor ajustado pelos desdobramentos posteriores
 * (`adj`), com o original em `ov`; como as cotações do COTAHIST não são
 * ajustadas, vale o original
 */
export function converterProventosStatusInvest(
  ativoId: string,
  dados: RootDividend | null,
): ProventoLinha[] {
  const linhas: ProventoLinha[] = []
  for (const item of dados?.assetEarningsModels ?? []) {
    const dataCom = brToIso(item.ed)
    const dataPagamento = brToIso(item.pd)
    const valor = item.adj && item.ov ? item.ov : item.v
    // Se o provento não tem data-com ou valor
    if (!dataCom || !(valor > 0)) {
      continue
    }
    linhas.push({
      ativoId,
      dataCom,
      // Presume que sem data de pagamento o crédito sai 15 dias depois
      dataPagamento: dataPagamento ?? addDays(dataCom, 15),
      valor,
      tipo: item.et || 'Rendimento',
      fonte: FONTE_STATUSINVEST,
    })
  }
  return linhas
}

/**
 * Busca os proventos de cada FII no statusinvest, um ticker por vez (em
 * paralelo o statusinvest bloqueia)
 *
 * Tickers consultados nos últimos 7 dias são pulados, o que permite retomar
 * uma ingestão interrompida
 *
 * @param tickers - Só consulta estes tickers; ausente = todos os FIIs
 */
export async function ingerirProventos(
  db: MarketDatabase,
  log: Log,
  force = false,
  tickers?: string[],
) {
  const ativos = ativosFii(db, tickers)
  const limite = addDays(new Date().toISOString().slice(0, 10), -7)

  let consultados = 0
  let semDados = 0
  for (const { ativo_id: ativoId, ticker } of ativos) {
    const chave = `proventos-si-${ativoId}`
    // Se o ticker foi consultado há pouco
    if (!force && (db.lerControle(chave) ?? '') >= limite) {
      continue
    }

    // Busca os proventos; o statusinvest responde `null` para o fundo que
    // ele não tem (em geral já encerrado), que fica com os estimados da CVM
    const dados = await statusInvestApi<RootDividend>(
      `fii/companytickerprovents?ticker=${ticker}&chartProventsType=2`,
    )
    const linhas = converterProventosStatusInvest(ativoId, dados)
    if (linhas.length === 0) {
      semDados++
    }
    db.substituirProventos(FONTE_STATUSINVEST, [ativoId], linhas)
    db.gravarControle(chave, new Date().toISOString().slice(0, 10))

    consultados++
    if (consultados % 100 === 0) {
      log(`proventos: ${consultados} tickers consultados`)
    }
    await Bun.sleep(250)
  }
  log(`proventos: ${consultados} tickers consultados, ${semDados} sem dados`)
}

/** Converte um número da CVM; `null` se vazio ou inválido */
function numero(texto: string | undefined): number | null {
  // Se o campo está vazio
  if (texto === undefined || texto.trim() === '') {
    return null
  }
  const valor = Number(texto)
  return Number.isFinite(valor) ? valor : null
}

/** Relação ISIN -> CNPJ pelo informe mensal (a mais recente vale) */
export function isinsCvm(db: MarketDatabase): Map<string, string> {
  const rows = db.db
    .prepare(
      `SELECT cnpj, json_extract(dados, '$.Codigo_ISIN') AS isin FROM cvm_linha
       WHERE arquivo = 'inf_mensal_fii_geral' ORDER BY data_referencia`,
    )
    .all() as { cnpj: string; isin: string | null }[]
  const mapa = new Map<string, string>()
  for (const row of rows) {
    const isin = (row.isin ?? '').trim()
    if (isin.length === 12) {
      mapa.set(isin, row.cnpj)
    }
  }
  return mapa
}

/**
 * Estima os proventos dos FIIs sem dado no statusinvest (em geral fundos já
 * encerrados) pelo informe mensal: dividend yield do mês x valor patrimonial
 * da cota, com data-com no fim do mês e pagamento 15 dias depois
 *
 * É uma aproximação: o valor e as datas reais podem diferir um pouco
 *
 * @param tickers - Só estima estes tickers; ausente = todos os FIIs
 */
export function estimarProventosCvm(
  db: MarketDatabase,
  log: Log,
  tickers?: string[],
) {
  // Carrega os FIIs sem provento do statusinvest (entre os pedidos) e o
  // CNPJ de cada um
  const pedidos = new Set(ativosFii(db, tickers).map((a) => a.ativo_id))
  const semProventos = (
    db.db
      .prepare(
        `SELECT a.ativo_id, a.primeira_data, a.ultima_data FROM ativo a
         WHERE a.codbdi = ? AND NOT EXISTS (
           SELECT 1 FROM provento p WHERE p.ativo_id = a.ativo_id AND p.fonte = ?
         )`,
      )
      .all(CODBDI_FII, FONTE_STATUSINVEST) as {
      ativo_id: string
      primeira_data: string
      ultima_data: string
    }[]
  ).filter((ativo) => pedidos.has(ativo.ativo_id))
  const isins = isinsCvm(db)
  const linhas: ProventoLinha[] = []

  const consulta = db.db.prepare(
    `SELECT data_referencia, versao, dados FROM cvm_linha
     WHERE cnpj = ? AND arquivo = 'inf_mensal_fii_complemento'
     ORDER BY data_referencia, versao`,
  )
  for (const ativo of semProventos) {
    const cnpj = isins.get(ativo.ativo_id)
    // Se o ativo não tem informe na CVM
    if (!cnpj) {
      continue
    }

    // Mantém a última versão de cada mês
    const meses = new Map<string, Record<string, string>>()
    for (const row of consulta.all(cnpj) as {
      data_referencia: string
      dados: string
    }[]) {
      meses.set(row.data_referencia, JSON.parse(row.dados))
    }

    for (const [referencia, dados] of meses) {
      let dy = numero(dados.Percentual_Dividend_Yield_Mes)
      const vp = numero(dados.Valor_Patrimonial_Cotas)
      // Se o mês não tem rendimento ou valor da cota
      if (!dy || dy <= 0 || !vp || vp <= 0) {
        continue
      }
      // Presume que acima de 5% ao mês o valor veio em percentual
      if (dy > 0.05) {
        dy /= 100
      }
      const dataCom = endOfMonth(referencia)
      // Se o mês é de antes ou depois da negociação do ativo
      if (dataCom < ativo.primeira_data || dataCom > ativo.ultima_data) {
        continue
      }
      linhas.push({
        ativoId: ativo.ativo_id,
        dataCom,
        dataPagamento: addDays(dataCom, 15),
        valor: Math.round(dy * vp * 1e6) / 1e6,
        tipo: 'Rendimento',
        fonte: FONTE_CVM_ESTIMADO,
      })
    }
  }

  db.substituirProventos(
    FONTE_CVM_ESTIMADO,
    semProventos.map((ativo) => ativo.ativo_id),
    linhas,
  )
  log(
    `proventos estimados pela CVM: ${linhas.length} (${semProventos.length} FIIs sem statusinvest)`,
  )
}

/** Variação de preço entre dois negócios abaixo da qual não se procura evento */
const SALTO_MINIMO = 1.6

/** Maior distância entre a razão das cotas emitidas e o fator inteiro */
const TOLERANCIA_COTAS = 0.25

/** Maior distância entre o salto do preço e o fator (o preço também oscila) */
const TOLERANCIA_PRECO = 0.35

/**
 * Detecta desdobramentos e grupamentos pelo salto do preço entre dois
 * negócios seguidos, confirmado pela quantidade de cotas no informe mensal
 *
 * O fator vem da razão das cotas emitidas (antes e depois do salto),
 * arredondada para o inteiro mais próximo: é exato, enquanto o salto do preço
 * mistura o fator com a oscilação do dia. Sem informe dos dois lados, o salto
 * é ignorado (fundos sem informe costumam ser ilíquidos e com preço ruidoso)
 *
 * @param tickers - Só verifica estes tickers; ausente = todos os FIIs
 */
export function detectarDesdobramentos(
  db: MarketDatabase,
  log: Log,
  tickers?: string[],
) {
  const isins = isinsCvm(db)
  const ativos = ativosFii(db, tickers)
  const precos = db.db.prepare(
    'SELECT data, fechamento FROM preco WHERE ativo_id = ? ORDER BY data',
  )
  const cotas = db.db.prepare(
    `SELECT data_referencia, dados FROM cvm_linha
     WHERE cnpj = ? AND arquivo = 'inf_mensal_fii_complemento'
     ORDER BY data_referencia, versao`,
  )
  const eventos: EventoLinha[] = []

  for (const ativo of ativos) {
    // Carrega a quantidade de cotas de cada mês (última versão)
    const cnpj = isins.get(ativo.ativo_id)
    const cotasMes = new Map<string, number>()
    if (cnpj) {
      for (const row of cotas.all(cnpj) as {
        data_referencia: string
        dados: string
      }[]) {
        const quantidade = numero(JSON.parse(row.dados).Cotas_Emitidas)
        if (quantidade && quantidade > 0) {
          cotasMes.set(row.data_referencia.slice(0, 7), quantidade)
        }
      }
    }
    const meses = [...cotasMes.keys()].sort()

    const serie = precos.all(ativo.ativo_id) as {
      data: string
      fechamento: number
    }[]
    for (let i = 1; i < serie.length; i++) {
      const anterior = serie[i - 1].fechamento
      const atual = serie[i].fechamento
      // Se falta preço
      if (anterior <= 0 || atual <= 0) {
        continue
      }

      // Calcula o salto do preço (cotas novas por cota antiga)
      const razao = anterior / atual
      // Se o preço não saltou
      if (razao < SALTO_MINIMO && razao > 1 / SALTO_MINIMO) {
        continue
      }

      // Busca a quantidade de cotas antes e depois do salto
      const mesAntes = meses
        .filter((mes) => mes < serie[i - 1].data.slice(0, 7))
        .at(-1)
      const mesDepois = meses.find((mes) => mes >= serie[i].data.slice(0, 7))
      // Se falta informe de um dos lados
      if (!mesAntes || !mesDepois) {
        continue
      }

      // Calcula o fator pela razão das cotas, arredondada para um inteiro (uma
      // emissão no mesmo mês ainda distorce o fator)
      const razaoCotas =
        (cotasMes.get(mesDepois) ?? 0) / (cotasMes.get(mesAntes) ?? 1)
      const inteiro =
        razaoCotas >= 1 ? Math.round(razaoCotas) : Math.round(1 / razaoCotas)
      const fator = razaoCotas >= 1 ? inteiro : 1 / inteiro
      // Se as cotas não mudaram num fator inteiro ou o preço não acompanhou
      if (
        inteiro < 2 ||
        Math.abs(razaoCotas / fator - 1) > TOLERANCIA_COTAS ||
        Math.abs(razao / fator - 1) > TOLERANCIA_PRECO
      ) {
        continue
      }

      eventos.push({
        ativoId: ativo.ativo_id,
        data: serie[i].data,
        tipo: fator > 1 ? 'desdobramento' : 'grupamento',
        fator,
        descricao: `${ativo.ticker}: ${anterior} -> ${atual}`,
        fonte: FONTE_DETECTADO,
      })
    }
  }

  db.substituirEventos(
    FONTE_DETECTADO,
    eventos,
    tickers?.length ? ativos.map((ativo) => ativo.ativo_id) : undefined,
  )
  log(`desdobramentos/grupamentos detectados: ${eventos.length}`)
}
