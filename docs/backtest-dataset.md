# Dicionário do dataset de FII

<!-- Gerado por `bun run backtest dicionario --gravar`; não edite à mão -->

Uma linha por FII negociável em cada data de decisão (1º pregão do mês,
ou da semana com `--frequencia semanal`). Tabela `dataset_fii` em
`data/backtest.db` e CSV em `data/dataset_fii.csv` (vírgula, decimal com
ponto, booleano 0/1, vazio = sem dado).

- **Features** (entradas do modelo): só dados conhecidos ANTES da data.
- **Scores**: o score de cada versão na data (também uma feature).
- **Rótulos** (o que prever): o que aconteceu DEPOIS da data. Nunca use um
  rótulo como entrada.

Veja `docs/backtest.md` (seção "Dataset para IA") para como dividir
treino e teste sem vazamento.

## Colunas de identificação

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `data` | texto | data da decisão (features com dados de antes dela) |
| `ativo_id` | texto | ISIN (identificador estável) |
| `ticker` | texto | ticker mais recente |
| `preco_base` | numero | preço de compra dos rótulos: fechamento da data (ou o anterior, se não negociou) |
| `negociou_no_dia` | booleano | houve negócio na data (senão preco_base é o fechamento anterior) |

## Features

### Identificação

| Coluna | Tipo | Unidade | Descrição | Fonte | Conhecida em |
| --- | --- | --- | --- | --- | --- |
| `cnpj` | texto | - | CNPJ do fundo (só dígitos) | CVM (ISIN do COTAHIST -> informe mensal) | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `nome` | texto | - | Nome do fundo na CVM | CVM, informe mensal (geral) | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `segmento` | texto | - | Classe pela composição do ativo: Tijolo, Papel, FoF (a classe com 60%+ do dinheiro) ou Híbrido | CVM, informe mensal (ativo/passivo) | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `segmento_atuacao` | texto | - | Segmento declarado pelo fundo (Logística, Shoppings, Lajes...) | CVM, informe mensal (geral) | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `mandato` | texto | - | Mandato declarado (Renda, Títulos e Valores Mobiliários...) | CVM, informe mensal (geral) | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `tipo_gestao` | texto | - | Gestão Ativa ou Passiva | CVM, informe mensal (geral) | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `idade_anos` | numero | anos | Anos desde o início do funcionamento (CVM); sem ele, desde a 1ª negociação na base (que começa em 2016) | CVM (Data_Funcionamento) ou COTAHIST | informe mensal da CVM entregue antes da data (versão válida no dia) |

### Mercado

| Coluna | Tipo | Unidade | Descrição | Fonte | Conhecida em |
| --- | --- | --- | --- | --- | --- |
| `preco` | numero | R$ | Fechamento do último pregão antes da data (sem ajuste) | B3, COTAHIST | fechamento do pregão anterior à data |
| `liquidez_media` | numero | R$/dia | Volume financeiro médio dos últimos 60 pregões (dias sem negócio contam zero) | B3, COTAHIST | fechamento do pregão anterior à data |
| `retorno_1m` | numero | % | Retorno total (preço + proventos, sem reinvestir) em 1 mês (30 dias), ajustado por desdobramento (momentum) | B3 + proventos | fechamento do pregão anterior à data |
| `retorno_3m` | numero | % | Retorno total (preço + proventos, sem reinvestir) em 3 meses (91 dias), ajustado por desdobramento (momentum) | B3 + proventos | fechamento do pregão anterior à data |
| `retorno_6m` | numero | % | Retorno total (preço + proventos, sem reinvestir) em 6 meses (182 dias), ajustado por desdobramento (momentum) | B3 + proventos | fechamento do pregão anterior à data |
| `retorno_12m` | numero | % | Retorno total (preço + proventos, sem reinvestir) em 12 meses (365 dias), ajustado por desdobramento (momentum) | B3 + proventos | fechamento do pregão anterior à data |
| `volatilidade_3m` | numero | % a.a. | Desvio padrão anualizado (x raiz de 252) dos retornos diários de preço em 3 meses; mínimo de 20 retornos | B3, COTAHIST | fechamento do pregão anterior à data |
| `volatilidade_12m` | numero | % a.a. | Como `volatilidade_3m`, em 12 meses | B3, COTAHIST | fechamento do pregão anterior à data |
| `queda_do_topo_12m` | numero | % | Preço atual em relação ao maior preço de 12 meses (0 = no topo; negativo = abaixo) | B3, COTAHIST | fechamento do pregão anterior à data |

### Proventos

| Coluna | Tipo | Unidade | Descrição | Fonte | Conhecida em |
| --- | --- | --- | --- | --- | --- |
| `dy_12m` | numero | % | Rendimentos dos últimos 12 meses (sem amortizações) / preço, na base de cotas atual | statusinvest (ou estimado pela CVM) | proventos com data-com antes da data |
| `amortizacao_12m` | numero | % | Amortizações (devolução de capital) dos últimos 12 meses / preço | statusinvest | proventos com data-com antes da data |
| `variacao_dividendos` | numero | - | Coeficiente de variação dos rendimentos de 12 meses (desvio / média); menor = mais estável; mínimo de 6 pagamentos | statusinvest | proventos com data-com antes da data |
| `crescimento_dividendos` | numero | % | Rendimentos dos últimos 6 meses / dos 6 anteriores - 1 | statusinvest | proventos com data-com antes da data |
| `meses_com_provento_12m` | numero | meses | Meses distintos com rendimento nos últimos 12 | statusinvest | proventos com data-com antes da data |
| `fonte_proventos` | texto | - | statusinvest (valor real) ou cvm_estimado (DY do mês x VP da cota, aproximado) | - | proventos com data-com antes da data |

### Fundamentos

| Coluna | Tipo | Unidade | Descrição | Fonte | Conhecida em |
| --- | --- | --- | --- | --- | --- |
| `vp_cota` | numero | R$ | Valor patrimonial por cota, na base de cotas atual | CVM, informe mensal | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `pvp` | numero | - | Preço / valor patrimonial por cota | B3 + CVM | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `variacao_vp_12m` | numero | % | Variação do VP da cota em 12 meses, ajustada por desdobramento | CVM, informe mensal | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `taxa_administracao` | numero | % a.a. | Despesa com taxa de administração (adm + gestão) / PL médio, média dos últimos 4 trimestres anualizados | CVM, informe trimestral + mensal | informe trimestral da CVM entregue antes da data (versão válida no dia) |
| `alavancagem` | numero | % | Obrigações por securitização e por aquisição de imóveis / ativo total | CVM, informe mensal | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `vacancia` | numero | % | Vacância média dos imóveis de renda prontos, pesada pela área (só Tijolo e Híbrido) | CVM, informe trimestral | informe trimestral da CVM entregue antes da data (versão válida no dia) |
| `diversificado` | booleano | - | Regra de diversificação da classe (ver src/config/fiiCriterios.ts); null = falta dado | CVM, informe trimestral | informe trimestral da CVM entregue antes da data (versão válida no dia) |
| `limite_distribuicao` | booleano | - | Distribuiu ao menos 95% do resultado do último semestre | CVM, informe trimestral | informe trimestral da CVM entregue antes da data (versão válida no dia) |
| `percentual_caixa` | numero | % | Ativos de liquidez (caixa, títulos públicos e privados, fundos de renda fixa) / ativo total | CVM, informe mensal | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `numero_cotistas` | numero | - | Total de cotistas | CVM, informe mensal | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `crescimento_cotistas_12m` | numero | % | Variação do número de cotistas em 12 meses | CVM, informe mensal | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `patrimonio_liquido` | numero | R$ | Patrimônio líquido | CVM, informe mensal | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `emissao_12m` | numero | % | Aumento da quantidade de cotas em 12 meses por emissões (desdobramentos descontados); diluição | CVM, informe mensal | informe mensal da CVM entregue antes da data (versão válida no dia) |

### Conhecimento

| Coluna | Tipo | Unidade | Descrição | Fonte | Conhecida em |
| --- | --- | --- | --- | --- | --- |
| `informe_mensal` | texto | - | Mês de referência do informe mensal usado (AAAA-MM-01) | CVM | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `informe_mensal_entregue` | texto | - | Data de entrega do informe mensal usado | CVM (Data_Entrega) | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `dias_desde_informe` | numero | dias | Dias entre a entrega do informe mensal usado e a data | CVM | informe mensal da CVM entregue antes da data (versão válida no dia) |

### Macro

| Coluna | Tipo | Unidade | Descrição | Fonte | Conhecida em |
| --- | --- | --- | --- | --- | --- |
| `selic_meta` | numero | % a.a. | Meta da Selic | BCB SGS 432 | último valor divulgado antes da data |
| `ipca_12m` | numero | % | IPCA acumulado em 12 meses (divulgado ~dia 10 do mês seguinte) | BCB SGS 13522 | IPCA do mês só a partir do dia 15 do mês seguinte |
| `ntnb_juro_real` | numero | % a.a. | Juro real da NTN-B (IPCA+ com juros semestrais) com vencimento mais próximo de 10 anos | Tesouro Direto (taxa de compra da manhã) | último valor divulgado antes da data |
| `cdi_12m` | numero | % | CDI acumulado nos últimos 12 meses | BCB SGS 12 | último valor divulgado antes da data |
| `spread_dy_ntnb` | numero | p.p. | DY 12m menos o juro real da NTN-B (prêmio do FII sobre o título público) | derivado | último valor divulgado antes da data |

### Relativo ao segmento

| Coluna | Tipo | Unidade | Descrição | Fonte | Conhecida em |
| --- | --- | --- | --- | --- | --- |
| `pvp_relativo_segmento` | numero | - | P/VP / mediana do P/VP dos fundos do mesmo segmento na data (< 1 = mais barato que os pares); mínimo de 5 fundos | derivado | informe mensal da CVM entregue antes da data (versão válida no dia) |
| `dy_relativo_segmento` | numero | p.p. | DY 12m menos a mediana do DY do segmento na data | derivado | proventos com data-com antes da data |
| `fundos_no_segmento` | numero | - | Fundos do mesmo segmento no universo da data | derivado | informe mensal da CVM entregue antes da data (versão válida no dia) |

### Alertas

| Coluna | Tipo | Unidade | Descrição | Fonte | Conhecida em |
| --- | --- | --- | --- | --- | --- |
| `alertas` | texto | - | Códigos dos alertas separados por vírgula (ver src/backtest/fii/alertas.ts) | derivado | mesma regra das features usadas |
| `alertas_risco` | numero | - | Quantidade de alertas de risco | derivado | mesma regra das features usadas |

## Scores

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `score_fii_v1` | numero | score fii-v1 (0 a 100); vazio sem cobertura mínima |
| `score_fii_v1_posicao` | numero | posição no ranking do fii-v1 na data (1 = melhor) |
| `score_fii_v0_dy_pvp` | numero | score fii-v0-dy-pvp (0 a 100); vazio sem cobertura mínima |
| `score_fii_v0_dy_pvp_posicao` | numero | posição no ranking do fii-v0-dy-pvp na data (1 = melhor) |

## Rótulos

Para cada horizonte H em dias (30, 90, 180, 365, 730, 1825), as colunas
abaixo têm o sufixo `_Hd` (exemplo com 365). Retornos em fração
(0,05 = 5%), com compra no fechamento da data (`preco_base`) e tudo na
base de cotas da data (desdobramentos ajustados). O "mercado" é a média
dos fundos com liquidez média >= R$ 500.000 na mesma data.
Horizontes que ainda não terminaram na base ficam vazios.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `data_fim_365d` | texto | último pregão até data + 365 dias |
| `ret_total_365d` | numero | retorno total (preço + proventos sem reinvestir) em 365 dias, fração |
| `ret_preco_365d` | numero | retorno do preço em 365 dias, fração |
| `ret_div_365d` | numero | proventos recebidos em 365 dias / preço de compra, fração |
| `drawdown_365d` | numero | pior queda do valor (preço + proventos) dentro dos 365 dias, fração <= 0 |
| `excesso_mercado_365d` | numero | ret_total menos a média dos fundos com liquidez >= 500000 na mesma data |
| `excesso_cdi_365d` | numero | ret_total menos o CDI acumulado no mesmo período |
| `bateu_mercado_365d` | booleano | excesso_mercado > 0 |
| `bateu_cdi_365d` | booleano | excesso_cdi > 0 |
| `percentil_365d` | numero | posição do ret_total entre os fundos da mesma data (0 = pior, 1 = melhor) |
| `completo_365d` | booleano | false se o fundo parou de negociar antes do fim do horizonte (retorno pelo último preço) |

## Limites dos alertas

| Limite | Valor |
| --- | --- |
| `dyMuitoAlto` | 16 |
| `dyBaixo` | 4 |
| `pvpMuitoBaixo` | 0.7 |
| `pvpAlto` | 1.3 |
| `alavancagemAlta` | 20 |
| `emissaoAlta` | 30 |
| `vacanciaAlta` | 15 |
| `informeAtrasado` | 75 |
| `liquidezBaixa` | 200000 |
| `quedaForte` | -25 |
| `dividendosEmQueda` | -20 |
