# Backtest de FIIs

Documentação completa do módulo de simulação histórica, do dataset para IA e
das ferramentas de apoio à decisão. O dicionário coluna a coluna do dataset
está em [`backtest-dataset.md`](backtest-dataset.md) (gerado a partir do
código).

## Sumário

1. [O que o módulo responde](#1-o-que-o-módulo-responde)
2. [Início rápido](#2-início-rápido)
3. [A regra central: nada do futuro](#3-a-regra-central-nada-do-futuro)
4. [Fontes de dados e ingestão](#4-fontes-de-dados-e-ingestão)
5. [A simulação passo a passo](#5-a-simulação-passo-a-passo)
6. [Configuração](#6-configuração)
7. [Score](#7-score)
8. [Benchmarks](#8-benchmarks)
9. [Saídas da simulação e como ler](#9-saídas-da-simulação-e-como-ler)
10. [Ficha de decisão](#10-ficha-de-decisão)
11. [Robustez](#11-robustez)
12. [Dataset para IA](#12-dataset-para-ia)
13. [Tabelas do banco](#13-tabelas-do-banco)
14. [Reprodutibilidade](#14-reprodutibilidade)
15. [Limitações conhecidas](#15-limitações-conhecidas)
16. [Como estender](#16-como-estender)
17. [Glossário](#17-glossário)

---

## 1. O que o módulo responde

- **Simulação** (`simular`, `run`, `compare`): "se eu tivesse seguido o score
  no passado, aportando todo mês, como estaria a carteira?", comparando com um
  benchmark e entre versões do score.
- **Relação score x retorno** (tabela de faixas): "fundos com score maior
  renderam mais depois?".
- **Robustez** (`robustez`): "o resultado depende do mês em que comecei?".
- **Ficha de decisão** (`ficha`): "hoje (ou numa data passada), o que se sabe
  deste fundo, por que ele tem esse score e o que aconteceu em situações
  parecidas?".
- **Dataset** (`dataset`): uma tabela por fundo e data com tudo o que era
  conhecido (features) e o que aconteceu depois (rótulos), para treinar um
  modelo que preveja retorno, decida comprar ou não e ranqueie fundos.

## 2. Início rápido

Todos os comandos são `bun run backtest <subcomando>` (atalho de
`bun scripts/backtest.ts`).

```bash
bun run backtest ingest                     # 1ª vez: baixa a base (~10 min)
bun run backtest simular --tickers XPML11   # atualiza e simula só o XPML11
bun run backtest simular                    # atualiza tudo e simula o top 5 do score
bun run backtest compare --scores fii-v1,fii-v0-dy-pvp
bun run backtest robustez --passo 3
bun run backtest dataset                    # monta o dataset e o CSV
bun run backtest ficha XPML11               # ficha de hoje
bun run backtest ficha XPML11 --data 2024-06-03
```

| Subcomando | O que faz |
| --- | --- |
| `simular [config.json]` | Atualiza a base e simula (sem arquivo: `scripts/backtest.exemplo.json`) |
| `ingest` | Só atualiza a base |
| `run [config.json]` | Só simula |
| `compare [config.json]` | Simula com várias versões de score, lado a lado |
| `robustez [config.json]` | Repete a simulação começando em cada mês |
| `dataset` | Monta o dataset de features e rótulos (tabela + CSV) |
| `ficha TICKER` | Ficha de decisão do fundo |
| `list` | Lista as simulações gravadas |
| `dicionario` | Mostra o dicionário do dataset (`--gravar` atualiza `docs/backtest-dataset.md`) |

| Opção | Vale para | O que faz |
| --- | --- | --- |
| `--tickers A,B` | `simular`, `run`, `compare`, `robustez`, `ingest` | Simula só com esses fundos (sem filtro de liquidez; o benchmark mantém o filtro). No `ingest`, atualiza só eles |
| `--inicial 10000` | simulações | Saldo inicial (R$), investido no 1º pregão |
| `--mensal 500` | simulações | Aporte mensal (R$); `0` = sem aportes |
| `--cotas XPML11:100` | simulações | Cotas que a carteira já tem no início |
| `--score v` / `--scores v1,v2` | simulações, `ficha` (`--score`), `dataset` (`--scores`) | Versões do score |
| `--passo 3` | `robustez` | Meses entre os inícios das janelas (padrão 1) |
| `--data AAAA-MM-DD` | `ficha` | Data da ficha (padrão: hoje, com os dados até o último pregão) |
| `--json` | `ficha` | Saída em JSON (para outra ferramenta ou uma IA) |
| `--frequencia semanal` | `dataset` | Uma linha por semana (padrão: mensal) |
| `--inicio` / `--fim` | `dataset` | Período do dataset |
| `--csv caminho` | `dataset`, `robustez` | Onde gravar o CSV |
| `--sem-csv` | `dataset` | Não grava o CSV (só a tabela) |
| `--force` | `ingest`, `simular` | Baixa tudo de novo, mesmo o que não mudou |
| `--desde 2016` | `ingest`, `simular` | Primeiro ano baixado |
| `--extras XFIX11` | `ingest` | Tickers de fora dos FIIs (ETFs de benchmark) |
| `--sem-proventos` | `ingest`, `simular` | Não consulta o statusinvest |

A base fica em `data/backtest.db` (variável `BACKTEST_DB` muda o caminho). Os
arquivos em `data/*.db` e os CSVs gerados não vão para o git.

## 3. A regra central: nada do futuro

Toda decisão numa data **D** usa só o que era público **antes de D**. Isso
vale para o score, o ranking, o universo, as features do dataset e a ficha.
A peça que garante é a `PointInTimeView` (`src/backtest/core/HistoricalDataProvider.ts`):
o score só recebe dados por ela.

| Dado | Visível na data D se... |
| --- | --- |
| Cotação | é de um pregão **anterior** a D (o score usa o fechamento da véspera) |
| Provento | a data-com é **anterior** a D |
| Informe mensal/trimestral da CVM | a **data de entrega** (`Data_Entrega`) é anterior a D, e vale a versão entregue até lá (reapresentações posteriores não contam) |
| Informe sem data de entrega | presume entrega 75 dias (mensal) ou 90 dias (trimestral) depois da referência (conservador) |
| IPCA | a partir do dia 15 do mês seguinte ao de referência |
| Selic meta, NTN-B, CDI | o valor do dia anterior a D |
| Desdobramento | a data do evento é anterior a D |

A **compra** acontece no fechamento de D (depois da decisão). Os **rótulos** do
dataset e as análises "o que aconteceu depois" olham para o futuro de
propósito: são o resultado a ser explicado, nunca uma entrada.

O **universo** de cada data também é histórico: entram os FIIs com negócio em
algum dos 10 pregões anteriores a D. Fundos que ainda não existiam não
aparecem; fundos encerrados somem quando param de negociar (e as cotações
deles continuam na base, o que evita o viés de sobrevivência).

## 4. Fontes de dados e ingestão

| Fonte | O que traz | Desde | Tabela | Atualização |
| --- | --- | --- | --- | --- |
| B3, COTAHIST (arquivo anual) | fechamento e volume de cada pregão de todos os FIIs (inclusive encerrados) e dos ETFs pedidos | 1986 (baixado desde 2016) | `preco`, `ativo` | anos fechados 1 vez; ano corrente no máximo 1x/dia |
| CVM, dados abertos | informes mensal (PL, VP da cota, cotas, cotistas, composição, dívidas, liquidez) e trimestral (taxa, resultado, imóveis, carteira) com a data de entrega | 2016 | `cvm_linha` | por ETag (a CVM republica ~semanalmente) |
| statusinvest | proventos com data-com, pagamento, tipo (rendimento/amortização) e valor original (sem ajuste de desdobramento) | início do fundo | `provento` | cada ticker no máximo 1x a cada 7 dias |
| CVM (estimativa) | proventos dos fundos que o statusinvest não tem (em geral encerrados): DY do mês x VP da cota, data-com no fim do mês, pagamento 15 dias depois | 2016 | `provento` (`fonte = cvm_estimado`) | a cada ingestão |
| BCB SGS | CDI diário (12), Selic meta (432), IPCA mensal (433) e 12 meses (13522) | 2016 | `cdi`, `macro` | anos fechados 1 vez; ano corrente 1x/dia |
| Tesouro Direto | juro real da NTN-B com vencimento mais perto de 10 anos | 2004 | `macro` | 1x/dia |
| Detecção própria | desdobramentos e grupamentos | - | `evento` | a cada ingestão |

**Desdobramentos**: um salto de preço de 1,6x ou mais entre dois negócios só
vira evento se a quantidade de cotas no informe mensal mudou num fator
inteiro compatível (até 25% de diferença; o preço pode divergir até 35%). O
fator é o das cotas (o preço do dia oscila). Sem informe dos dois lados, o
salto é ignorado.

**Detalhes que importam** (e que a ingestão já trata):

- Nos dias ex-rendimento a B3 grava a especificação como `CI  ER`; só o
  primeiro termo conta (antes de corrigir isso, ~40% das cotações sumiam).
- O zip do COTAHIST de 2025 em diante usa "data descriptor"; a leitura vai
  direto ao deflate.
- Até 2021 os CSVs da CVM usam `CNPJ_Fundo`; a ingestão renomeia para
  `CNPJ_Fundo_Classe`.
- O statusinvest devolve o provento ajustado por desdobramento (`v`) e o
  original em `ov`; como o COTAHIST não é ajustado, vale o original.

**Tempos** (máquina de desenvolvimento): primeira ingestão completa ~10 min
(4 min só dos proventos); atualização diária ~30 s; `simular --tickers X` ~2 s
de atualização.

## 5. A simulação passo a passo

Motor: `src/backtest/core/Backtest.ts`. Em cada pregão do período, nesta
ordem:

1. **Desdobramentos** do dia multiplicam a quantidade de cotas (grupamento
   vende a fração que sobra). **Proventos** com pagamento até hoje entram no
   caixa.
2. **Encerramento**: posição sem negócio há 30 pregões é vendida ao último
   preço (tipo `encerramento`). É como a simulação trata fundos liquidados ou
   incorporados.
3. **Provisão** dos proventos com data-com entre o pregão anterior e hoje
   (quem tinha a cota recebe no pagamento).
4. **Primeiro pregão**: entram as `cotasIniciais` (avaliadas pelo fechamento
   do dia) e o `saldoInicial`.
5. **Dia de aporte** (ou primeiro pregão com saldo inicial):
   - monta o universo com os dados de antes de hoje e aplica o filtro:
     `selecao.tickers` (se houver, sem filtro de liquidez) ou
     `liquidezMinima`;
   - calcula o score e o ranking;
   - seleciona os `quantidade` primeiros com score >= `scoreMinimo` e negócio
     hoje;
   - se é dia de **rebalanceamento**, vende as posições que saíram da seleção;
   - divide o caixa entre os selecionados (`distribuicao`) e compra no
     fechamento, só cotas inteiras (a sobra fica no caixa);
   - registra o ranking inteiro (selecionados ou não), com os critérios.
6. **Provisão** dos proventos com data-com hoje (quem comprou hoje recebe).
7. **Avaliação** no fechamento: posições ao último preço + caixa + dividendos
   parados + proventos a receber; cota da carteira e patrimônio do benchmark.

**Regras de operação**

| Regra | Padrão | Configuração |
| --- | --- | --- |
| Custo por operação | 0,03% do valor | `custoOperacao` |
| IR sobre o lucro da venda | 20%, com compensação de prejuízo acumulado | `aliquotaIr` |
| Frações de cota | não | `fracionado` |
| Proventos | isentos (regra de FII para pessoa física) | - |
| Dividendos | com `reinvestirDividendos`, vão para o caixa e entram no próximo aporte; sem, ficam parados (contam no patrimônio, não compram nada) | `reinvestirDividendos` |

**Datas de aporte**: mensal = primeiro pregão a partir do `dia` (se o mês
acabar antes, o último pregão do mês); semanal = primeiro pregão a partir do
dia da semana (1 = segunda); diária = todo pregão. O primeiro mês com
aporte é o do início da simulação.

**Distribuição**: `igual` (partes iguais), `proporcional_score` (pelo score) e
`menor_peso` (prioriza quem tem menos na carteira, até igualar).

**Rebalanceamento** (`mensal`, `trimestral`, `semestral`, `anual`): na primeira
data de aporte de cada período, vende o que não está na seleção do dia e
reinveste. Não reduz posições que continuam selecionadas.

**Período**: `inicio`/`fim` ou `anos` contados para trás a partir do último
pregão. Como os informes da CVM começam em 2016, a simulação começa, no mais
cedo, no primeiro mês em que metade dos FIIs negociados já tinha informe
(hoje, 2017). Pedidos de 15 ou 20 anos são ajustados com aviso.

## 6. Configuração

Arquivo JSON validado por `src/backtest/core/configSchema.ts` (zod). Campo
desconhecido ou valor fora da lista é erro, com a lista dos problemas.

| Campo | Tipo | Padrão | Descrição |
| --- | --- | --- | --- |
| `nome` | texto | - | Rótulo livre |
| `inicio`, `fim` | AAAA-MM-DD | fim = último pregão | Período |
| `anos` | número | - | Período contado do fim, quando não há `inicio` |
| `saldoInicial` | R$ | 0 | Investido no primeiro pregão |
| `cotasIniciais` | `[{ticker, quantidade}]` | `[]` | Carteira inicial; o valor conta como aportado |
| `aporte.valor` | R$ | obrigatório | Valor de cada aporte (0 = sem aportes) |
| `aporte.frequencia` | `diaria`, `semanal`, `mensal` | obrigatório | |
| `aporte.dia` | 1 a 31 | 1 | Dia do mês (mensal) ou da semana (semanal) |
| `selecao.quantidade` | inteiro | obrigatório | Fundos comprados por aporte |
| `selecao.scoreMinimo` | 0 a 100 | 0 | |
| `selecao.liquidezMinima` | R$/dia | 0 | Filtro do universo (e do benchmark `universo`) |
| `selecao.tickers` | lista | - | Restringe o universo (sem filtro de liquidez) |
| `distribuicao` | `igual`, `proporcional_score`, `menor_peso` | obrigatório | |
| `reinvestirDividendos` | booleano | obrigatório | |
| `rebalanceamento.frequencia` | `nenhum`, `mensal`, `trimestral`, `semestral`, `anual` | obrigatório | |
| `benchmark` | `{tipo: cdi}`, `{tipo: universo}`, `{tipo: ativo, ticker}` | obrigatório | |
| `score` | texto | obrigatório | Versão (`fii-v1`, `fii-v0-dy-pvp`) |
| `fracionado` | booleano | false | |
| `aliquotaIr` | 0 a 1 | 0,2 | |
| `custoOperacao` | 0 a 0,1 | 0,0003 | |
| `horizontes` | dias | 30, 90, 180, 365, 730, 1825 | Horizontes da análise depois de cada recomendação |

As opções `--tickers`, `--inicial`, `--mensal` e `--cotas` sobrescrevem o
arquivo.

## 7. Score

`src/backtest/core/Scorer.ts` (genérico) e `src/backtest/fii/FiiScorer.ts`.

- Cada critério tem um **peso** e uma **faixa**: pontos (valor, nota) com
  interpolação linear entre eles e a nota da ponta fora deles. Critério
  booleano vale 100 (sim) ou 0 (não).
- **Score** = média das notas pesada pelos pesos, só com os critérios que têm
  dado. Falta de dado não puxa o score para baixo.
- **Cobertura** = peso com dado / peso total. Abaixo da `coberturaMinima` o
  fundo fica sem score (não entra no ranking).
- **Ranking**: score decrescente; empate pela maior liquidez, depois pelo
  ticker.

### fii-v1 (cobertura mínima 60%)

| Critério | Peso | Faixa (valor → nota) |
| --- | --- | --- |
| `pvp` | 20 | 0,8 → 100; 1,0 → 60; 1,2 → 10; 1,4 → 0 |
| `dy12m` (%) | 20 | 4 → 0; 8 → 60; 11 → 100; 16 → 100; 22 → 40 (DY alto demais costuma ser extraordinário ou crise) |
| `liquidez` (R$/dia) | 10 | 50 mil → 0; 500 mil → 50; 2 mi → 80; 5 mi → 100 |
| `taxa_administracao` (% a.a.) | 10 | 0,5 → 100; 1 → 60; 1,5 → 20; 2 → 0 |
| `alavancagem` (% do ativo) | 10 | 5 → 100; 15 → 60; 30 → 0 |
| `vacancia` (%) | 10 | 3 → 100; 10 → 60; 25 → 0 (só Tijolo/Híbrido) |
| `diversificado` | 10 | sim/não (regra em `src/config/fiiCriterios.ts`) |
| `limite_distribuicao` | 5 | distribuiu >= 95% do resultado do semestre |
| `estabilidade_dividendos` | 5 | coeficiente de variação 0,1 → 100; 0,3 → 50; 0,6 → 0 |

Ficam de fora os critérios sem histórico confiável: gestora confiável (a
lista é de hoje), LTV e spread (relatório gerencial) e boa localização
(classificação feita com os dados atuais).

### fii-v0-dy-pvp (cobertura mínima 100%)

Só `pvp` e `dy12m`, com as faixas da v1. Serve de "score anterior" para
comparar.

O DY usado é só de **rendimentos**: amortizações (devolução de capital) ficam
de fora e aparecem na feature `amortizacao_12m`.

## 8. Benchmarks

Todo benchmark vira um índice de retorno total; os aportes compram "cotas"
desse índice nos mesmos dias e valores da carteira, então a comparação é justa.

| Tipo | Regra |
| --- | --- |
| `cdi` | CDI diário acumulado |
| `ativo` | um ticker com os proventos reinvestidos no dia ex (ex.: `XFIX11`, ETF do IFIX, ou um FII); parado nos dias sem negócio |
| `universo` | média igual dos FIIs com a `liquidezMinima` da configuração, carteira montada no fechamento do último pregão de cada mês com o universo conhecido no mês seguinte e mantida até o fim do mês. Retornos mensais de +-100% ou mais são tratados como erro de dado. Rebalancear todo dia inflaria o retorno (efeito da oscilação entre compra e venda dos ilíquidos) |

## 9. Saídas da simulação e como ler

### Linha de entrada

`Saldo inicial R$ 10.000,00 | cotas iniciais: 100 XPML11 a R$ 96,20 | aporte mensal de R$ 500,00`
mostra como o dinheiro entrou.

### Tabela principal

Uma coluna por versão de score e uma para o benchmark. Exemplo real (5 anos,
R$ 1.000/mês só em XPML11, set/2021 a set/2026):

| Campo | Exemplo | Significado e fórmula |
| --- | --- | --- |
| Aportado | R$ 61.000 | soma dos aportes + saldo inicial + valor das cotas iniciais |
| Patrimônio final | R$ 75.998 | posições ao último preço + caixa + dividendos parados + proventos a receber |
| Retorno acumulado | 24,59% | patrimônio / aportado - 1 (o dinheiro que entrou por último rendeu por menos tempo) |
| Retorno da cota | 61,46% | variação da "cota" da carteira: retorno como se todo o dinheiro estivesse lá desde o início (sem efeito dos aportes); cada aporte compra cotas pelo valor do dia |
| CAGR | 10,06% | (1 + retorno da cota)^(365/dias) - 1: desempenho anual da estratégia |
| TIR | 8,67% | taxa anual que zera o valor presente dos aportes (negativos) e do patrimônio final (positivo): o rendimento real do seu dinheiro com aportes mensais |
| Drawdown máximo | -18,03% | pior queda da cota em relação ao pico anterior |
| Volatilidade | 14,40% | desvio padrão dos retornos diários da cota x raiz de 252 |
| Sharpe | -0,08 | (média dos retornos diários - CDI do dia) x 252 / (desvio do excesso x raiz de 252); negativo = rendeu menos que o CDI |
| Sortino | -0,12 | como o Sharpe, mas o denominador só considera os dias abaixo do CDI |
| Valorização | -R$ 4.397 | patrimônio - aportado - proventos + IR + custos: ganho (ou perda) só de preço |
| Dividendos recebidos | R$ 19.419 | proventos recebidos + a receber |
| Dividendos reinvestidos | R$ 19.419 | recebidos, quando `reinvestirDividendos` |
| IR pago | R$ 0 | IR sobre o lucro das vendas (rebalanceamento, encerramento) |
| Excesso de CAGR | 4,65% | CAGR da estratégia - CAGR do benchmark (aqui, a média dos FIIs com liquidez >= R$ 500 mil) |
| Excesso de patrimônio | R$ 7.173 | patrimônio final da estratégia - do benchmark |

Conta de conferência: aportado + valorização + dividendos - IR - custos =
patrimônio final.

### Retorno em 1 ano por faixa de score

Para cada data de aporte, todos os fundos com score (selecionados ou não) são
agrupados por faixa de 10 pontos, e mede-se o retorno total nos 365 dias
seguintes:

| Coluna | Significado |
| --- | --- |
| Observações | quantas vezes (fundo x data) houve score na faixa e o ano seguinte já terminou |
| Retorno médio / Mediana | retorno total (preço + proventos, sem reinvestir) no ano seguinte |
| Acerto | parte das observações com retorno positivo |
| Excesso vs média | retorno menos a média de todos os fundos com score na mesma data (tira o efeito do mercado) |

Se faixas maiores têm excesso maior, o score separa bem. Com `--tickers`
(poucos fundos) a tabela diz pouco: as observações são do mesmo fundo e o
excesso é zero (ele é comparado consigo mesmo).

### O que fica gravado

Cada execução grava nas tabelas `backtest_*` (seção 13): o ranking completo
de cada aporte, o retorno de cada recomendação em cada horizonte, as
operações, os dividendos e a carteira dia a dia.

## 10. Ficha de decisão

`bun run backtest ficha XPML11 [--data AAAA-MM-DD] [--score fii-v1] [--json]`

| Bloco | O que mostra | Como usar |
| --- | --- | --- |
| Cabeçalho | score, posição no ranking de todos os FIIs e percentil no segmento | visão rápida |
| Como o score foi formado | para cada critério: valor, nota, peso, pontos somados e perdidos (somados = nota x peso / peso com dado; a soma dá o score) | entender o porquê; critérios "sem dado" não entram na conta |
| Alertas | sinais que merecem olhar (DY alto demais, alavancagem, emissão recente, vacância, informe atrasado, proventos estimados...) com gravidade `atencao` ou `risco` | os alertas não entram no score; limites em `src/backtest/fii/alertas.ts` |
| Melhores do segmento | os 5 de maior score no mesmo segmento | comparar alternativas |
| Situações parecidas | fundos do mesmo segmento com score a até 5 pontos, em datas cujo horizonte já terminou antes da data da ficha: casos, mediana, pior e melhor 10%, positivos, bateu mercado, bateu CDI (90 dias e 1 ano) | a distribuição, não só a média: "pior 10%" é o risco realista |
| Histórico do próprio fundo | score nas 12 datas anteriores e o retorno depois | ver se o score do fundo acertou antes |
| Dados conhecidos na data | todas as features, com unidade | conferir os números |

Cuidados: os casos parecidos se sobrepõem no tempo (o mesmo ano de mercado
aparece em vários meses), então 500 casos não são 500 experimentos
independentes. O histórico precisa do dataset (`bun run backtest dataset`)
montado com o mesmo score. A ficha de uma data passada mostra exatamente o
que se sabia naquele dia.

## 11. Robustez

`bun run backtest robustez [config.json] [--passo 3] [--scores v1,v2]`

Repete a simulação com a mesma duração (`anos` da configuração, padrão 5),
começando em cada mês (ou a cada `--passo` meses) desde o primeiro mês com
dados, até o último início que ainda cabe na base. Mostra, por versão:

- **bateu o benchmark**: parte das janelas em que o patrimônio final da
  estratégia foi maior que o do benchmark (mesma coisa que TIR maior, já que
  os fluxos são iguais);
- mínimo, quartis, mediana e máximo do CAGR, da TIR, do excesso de CAGR e do
  drawdown máximo.

O excesso de CAGR (baseado na cota) e "bateu o benchmark" (baseado no
patrimônio) podem discordar: o primeiro ignora o momento dos aportes, o
segundo não. As janelas vão para `data/robustez_<data>.csv`.

## 12. Dataset para IA

`bun run backtest dataset [--frequencia semanal] [--scores ...] [--inicio] [--fim]`

Grava a tabela `dataset_fii` (e `dataset_meta`) e o CSV `data/dataset_fii.csv`.
Dicionário completo: [`backtest-dataset.md`](backtest-dataset.md).

### Estrutura

Uma linha por FII negociável em cada data (1º pregão do mês). ~28 mil linhas
e ~120 colunas no mensal (2017 a 2026).

- **Identificação**: `data`, `ativo_id` (ISIN), `ticker`, `preco_base`.
- **Features** (entradas): mercado (retornos, volatilidade, queda do topo,
  liquidez), proventos (DY, amortização, estabilidade, crescimento),
  fundamentos (P/VP, VP, taxa, alavancagem, vacância, diversificação, caixa,
  cotistas, emissões), conhecimento (idade do informe), macro (Selic, IPCA,
  NTN-B, CDI, spread do DY sobre a NTN-B), relativo ao segmento e alertas.
- **Scores**: o score de cada versão e a posição no ranking (também podem ser
  features).
- **Rótulos** (o que prever), por horizonte de 30, 90, 180, 365, 730 e 1825
  dias: retorno total, de preço e de proventos, drawdown, excesso sobre o
  mercado e sobre o CDI, bateu mercado/CDI, percentil na data e se o fundo
  continuou negociando.

### Tarefas e colunas-alvo sugeridas

| Tarefa | Alvo | Métrica de avaliação sugerida |
| --- | --- | --- |
| Prever retorno | `ret_total_365d` (ou `excesso_mercado_365d`, que tira o efeito do mercado) | erro absoluto; correlação de Spearman entre previsão e retorno em cada data (IC), média ao longo das datas |
| Comprar ou não | `bateu_mercado_365d` ou `bateu_cdi_365d` | AUC; precisão entre os que o modelo manda comprar |
| Ranquear | `percentil_365d` (0 a 1 na data) | NDCG ou retorno médio dos top-k de cada data; comparar com os top-k do `score_fii_v1` |
| Risco | `drawdown_365d` | erro absoluto; acerto nos piores 10% |

Prever o **excesso** ou o **percentil** costuma ser mais útil que o retorno
bruto: o modelo aprende a escolher entre fundos, e não a adivinhar o mercado.

### Como dividir treino e teste sem vazamento

1. **Sempre por tempo**, nunca aleatório. Ex.: treino até 2022, validação
   2023, teste 2024 em diante.
2. **Folga (purge)** entre as partes do tamanho do horizonte: uma linha de
   treino de dez/2022 com alvo de 365 dias "vê" 2023 inteiro. Tire do treino
   as linhas com `data_fim_365d` >= início da validação.
3. **Validação andando no tempo** (walk-forward): treina até o ano N, testa em
   N+1, avança.
4. Não use colunas de rótulo (`ret_*`, `excesso_*`, `bateu_*`, `percentil_*`,
   `drawdown_*`, `data_fim_*`, `completo_*`) como entrada.
5. Linhas com o rótulo vazio (horizonte ainda não terminou) ficam fora do
   treino daquele alvo.
6. Linhas com `completo_365d = 0` são de fundos que pararam de negociar: o
   retorno é pelo último preço (em geral uma perda real); não descarte sem
   pensar, isso criaria viés de sobrevivência.
7. `fonte_proventos = cvm_estimado` indica proventos aproximados.

### Exemplo em Python

```python
import pandas as pd

df = pd.read_csv('data/dataset_fii.csv', parse_dates=['data'])
alvo = 'excesso_mercado_365d'
rotulo = ('ret_', 'excesso_', 'bateu_', 'percentil_', 'drawdown_', 'data_fim_', 'completo_')
features = [c for c in df.columns
            if not c.startswith(rotulo) and c not in ('data', 'ativo_id', 'ticker', 'cnpj', 'nome')]

df = df[df[alvo].notna()]
treino = df[(df.data < '2023-01-01') & (pd.to_datetime(df.data_fim_365d) < '2023-01-01')]
teste = df[df.data >= '2024-01-01']
# categóricas: segmento, segmento_atuacao, mandato, tipo_gestao, fonte_proventos
```

### Como regenerar

`bun run backtest ingest` (atualiza a base) e `bun run backtest dataset`. O
dataset guarda em `dataset_meta` o commit do código, o estado da base e as
opções usadas.

## 13. Tabelas do banco

`data/backtest.db` (SQLite):

| Tabela | Chave | Conteúdo |
| --- | --- | --- |
| `ativo` | `ativo_id` (ISIN) | ticker mais recente, código BDI (12 = FII, 14 = ETF), primeira e última negociação |
| `preco` | `ativo_id`, `data` | fechamento, volume financeiro, número de negócios (sem ajuste) |
| `provento` | `ativo_id`, `data_com`, `data_pagamento`, `tipo`, `fonte` | valor por cota na base da data-com |
| `evento` | `ativo_id`, `data`, `tipo` | desdobramentos/grupamentos (`fator` = cotas novas por antiga); no futuro, fatos relevantes e notícias |
| `cdi` | `data` | taxa diária (fração) |
| `macro` | `serie`, `data` | valor e `conhecido_em` (data de divulgação) |
| `cvm_linha` | - | linhas dos informes com `data_referencia`, `versao`, `data_entrega` e as colunas usadas (JSON) |
| `ingestao` | `chave` | controle do que já foi baixado |
| `backtest_execucao` | `id` | configuração, resumo, faixas, posições finais, avisos, versão dos dados, commit do código e configuração do score |
| `backtest_recomendacao` | `id` | ranking de cada aporte: data, ativo, score, cobertura, posição, preço, selecionado, compra, critérios (JSON) |
| `backtest_retorno` | `recomendacao_id`, `horizonte` | retorno de cada recomendação em cada horizonte e até o fim (`fim`) |
| `backtest_operacao` | - | compras, vendas, desdobramentos, encerramentos, cotas iniciais |
| `backtest_dividendo` | - | proventos recebidos pela carteira |
| `backtest_carteira` | `execucao_id`, `data` | carteira e benchmark dia a dia |
| `dataset_fii` | - | o dataset (seção 12) |
| `dataset_meta` | `tabela` | como o dataset foi montado |

Consultas úteis:

```sql
-- Recomendações compradas de uma execução e o retorno em 1 ano
SELECT r.data, r.ticker, r.score, t.retorno_total
FROM backtest_recomendacao r
JOIN backtest_retorno t ON t.recomendacao_id = r.id AND t.horizonte = '365'
WHERE r.execucao_id = ? AND r.selecionado = 1;

-- Recomendação -> eventos do fundo nos 12 meses seguintes (base para cruzar com notícias)
SELECT r.data, r.ticker, e.data AS evento, e.tipo, e.descricao
FROM backtest_recomendacao r
JOIN evento e ON e.ativo_id = r.ativo_id
  AND e.data > r.data AND e.data <= date(r.data, '+365 days')
WHERE r.execucao_id = ? AND r.selecionado = 1;
```

## 14. Reprodutibilidade

Cada execução e cada dataset gravam:

- `dados_versao`: última ingestão e contagens de cada tabela;
- `codigo_versao`: commit do git (`+alterado` se havia mudanças não
  commitadas em `src`);
- `score_config` (execuções): critérios, pesos, faixas e cobertura mínima do
  score usado;
- a configuração completa.

A mesma base + o mesmo commit + a mesma configuração dão o mesmo resultado.

## 15. Limitações conhecidas

- **Período**: fundamentos da CVM só desde 2016, então a simulação vai de
  2017 em diante.
- **Incorporações e liquidações**: tratadas como venda ao último preço depois
  de 30 pregões sem negócio, não como troca por cotas do fundo incorporador.
- **Desdobramentos**: o fator vem da razão das cotas da CVM; uma emissão no
  mesmo mês distorce (ex.: MXRF11 em 2017 sai 14 em vez de 10).
- **Proventos estimados** (`cvm_estimado`): valor e datas aproximados.
- **Execução**: sempre ao fechamento, sem limite de volume (comprar muito de
  um fundo ilíquido seria mais caro na prática).
- **Segmento**: deduzido da composição do ativo (Tijolo/Papel/FoF/Híbrido); o
  `segmento_atuacao` da CVM é o declarado.
- **Vacância**: só fundos de imóveis; `diversificado` fica vazio quando falta
  dado.
- **Macro**: o IPCA usa uma data de divulgação presumida (dia 15).
- **Estatística**: janelas sobrepostas (faixas, ficha, robustez) não são
  observações independentes.

## 16. Como estender

**Nova versão de score**: crie uma `ScoreConfig<FiiSnapshot>` em
`src/backtest/fii/FiiScorer.ts` e registre em `FII_SCORES`. Ela já funciona em
`--score`, `compare`, `robustez`, `ficha` e `dataset --scores`.

**Nova feature**: calcule o campo no `FiiSnapshot`
(`src/backtest/fii/FiiHistoricalProvider.ts`, só com dados da visão ou
entregues antes da data), descreva em `src/backtest/fii/features.ts` e rode
`bun run backtest dicionario --gravar`. Um teste falha se o dicionário ficar
desatualizado.

**Nova fonte**: grave com a data em que o dado ficou público (como
`conhecido_em` na tabela `macro` ou `data_entrega` na `cvm_linha`) e exponha
pela `PointInTimeView`.

**Ações**: o núcleo (`src/backtest/core`) não sabe o que é um FII. Crie:

1. `StockHistoricalProvider extends HistoricalDataProvider<StockSnapshot>`
   (COTAHIST com código BDI 02, fundamentos com data de divulgação);
2. `StockScorer extends Scorer<StockSnapshot>` com as versões de score;
3. `StockBacktest extends Backtest<StockSnapshot>`;
4. `STOCK_FEATURES` para o dataset.

Simulação, benchmarks, métricas, robustez, ficha e dataset funcionam sem
mudança.

**Notícias** (etapa futura): grave na tabela `evento` com `ativo_id`, a data
de publicação, o tipo e a descrição. As recomendações já guardam o ativo e a
data, então o cruzamento é um JOIN (seção 13).

## 17. Glossário

| Termo | Significado |
| --- | --- |
| Data-com | último dia para comprar e ter direito ao provento |
| Data ex | dia seguinte à data-com; o preço costuma cair o valor do provento |
| Amortização | devolução de parte do capital; não é rendimento |
| P/VP | preço / valor patrimonial por cota |
| DY | dividend yield: proventos / preço |
| Desdobramento | cada cota vira N cotas (o preço divide por N) |
| Grupamento | N cotas viram uma (o preço multiplica por N) |
| Cota da carteira | índice que mede o retorno sem o efeito dos aportes |
| CAGR | taxa anual composta de crescimento |
| TIR | taxa interna de retorno dos fluxos (aportes e resgate) |
| Drawdown | queda em relação ao pico anterior |
| Look-ahead bias | usar, numa decisão passada, informação que só existia depois |
| Viés de sobrevivência | analisar só quem sobreviveu (fundos ainda listados) |
| Point-in-time | o dado como era conhecido naquela data |
| Purge | folga entre treino e teste para rótulos que se sobrepõem no tempo |
