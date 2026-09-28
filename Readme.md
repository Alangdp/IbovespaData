# IbovespaData

API que consome o histórico de 5 anos de preços e dividendos de ações brasileiras
(statusinvest / fundamentus) e de FIIs (statusinvest), pontua os papéis pelos métodos
de Bazin e Graham e simula investimentos ao longo do tempo. Tudo é guardado em
cache no Redis.

## Como rodar

Requer [Bun](https://bun.sh) (versão em `.tool-versions`) e Docker (para o Redis).

```sh
cp .env.example .env     # ajuste se necessário
docker compose up -d     # sobe o Redis (com notify-keyspace-events, ver redis.conf)
bun install
bun dev                  # http://localhost:3000, recarrega ao salvar
```

| Comando | O que faz |
| --- | --- |
| `bun dev` | Servidor com hot reload |
| `bun start` | Servidor (produção) |
| `bun run build` | Gera um bundle único em `dist/` (opcional; o Bun roda o TS direto) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun test` | Testes (não precisam de Redis nem de rede) |
| `bun run test:update` | Regrava os golden files em `tests/golden/data` |
| `bun run fixtures:record` | Regrava as respostas HTTP em `tests/fixtures` (usa a rede) |
| `bun run queue:start` | Enfileira todos os tickers da B3 para o worker atualizar o cache |
| `bun run lint` / `bun run lint:fix` | Biome (verifica / corrige) |
| `bun run cvm:refresh` | Atualiza na hora a base de informes da CVM no Redis |
| `bun run backtest <subcomando>` | Backtest de FIIs (ver [Backtest de FIIs](#backtest-de-fiis)) |

Docker: `docker build -t ibovespadata .` gera a imagem da API (a API precisa de
`REDIS_HOST` apontando para o Redis).

## Rotas

`GET /stock/:ticker` (e `/price`, `/dividends`, `/indicators`, `/graham`, `/history`,
`/dividends/history`), `GET /bazin/:ticker`, `GET /graham/:ticker`,
`GET /simulation/:ticker`, `GET /fundos` (`?tickers=A,B`), `GET /fundos/:ticker` e
imagens em `/images/avatar/*` e `/images/logos/*`.

`GET /fundos/:ticker/taxas` mostra o cálculo da taxa de administração trimestre a
trimestre, e `GET /fundos/:ticker/criterios` o de `diversificado`,
`boa_localizacao` e `gestora_confiavel`. `GET /fundos/regioes` lista a
classificação das cidades (base da localização) e `GET /gestoras` as gestoras
de FII, para montar a lista de confiáveis.

Os campos `gestora`, `taxa_administracao`, `limite_distribuicao_respeitado`,
`diversificado` e `boa_localizacao` vêm dos dados abertos da CVM (informes
mensal, trimestral e anual de todos os FIIs); a cidade de cada imóvel sai do
endereço, comparado com os municípios do IBGE. Os limites das regras ficam em
`src/config/fiiCriterios.ts`. O `gestora_confiavel` compara o CNPJ da gestora
com `data/gestoras-confiaveis.json` (lista mantida à mão, relida quando muda;
vazia, o campo fica `null`):

```json
{ "gestoras": [{ "cnpj": "16789525000198", "nome": "XP Vista" }] }
```


Um job diário (6h) consulta o ETag dos zips e só baixa quando a CVM republica
(em geral 1x por semana); para carregar na hora: `bun run cvm:refresh` (ou
`bun run cvm:refresh -- --force`).

O `ltv_medio` e o `spread_credito` (fundos de Papel e Híbrido) são lidos do
relatório gerencial mais recente no FNET, procurando "LTV médio"/"LTV
consolidado" e "spread médio"/"spread de crédito" no texto do PDF; ficam
`null` quando a gestora não publica a média. Como o FNET é lento (de 2 s a
mais de 1 min por PDF), a leitura roda numa fila em segundo plano: a primeira
consulta do fundo volta sem LTV e as seguintes já trazem o valor (cache de 7
dias).

As rotas `/fundos` estão documentadas em `openapi.yaml`: o `data` segue o schema
`Fundo` do contrato do comparador de FIIs (`fii-api.yaml`), com campos extras
marcados como "Extra". Um teste em `tests/http/routes.test.ts` falha se a
resposta e o schema divergirem.

## Backtest de FIIs

Simulação histórica de aportes seguindo o score de FII, sem usar informação
do futuro (cada decisão só vê o que era público antes da data), com dataset
de features e rótulos para treinar IA, ficha de decisão por fundo e análise
de robustez. **Documentação completa: [`docs/backtest.md`](docs/backtest.md)**
(regras, saídas, configuração, dataset, tabelas, limitações) e dicionário do
dataset em [`docs/backtest-dataset.md`](docs/backtest-dataset.md).

```bash
bun run backtest ingest                     # 1ª vez: baixa a base histórica (~10 min)
bun run backtest simular --tickers XPML11   # atualiza e simula só o XPML11
bun run backtest simular --inicial 10000 --mensal 500 --cotas XPML11:100
bun run backtest compare --scores fii-v1,fii-v0-dy-pvp
bun run backtest robustez --passo 3         # resultado com início em cada mês
bun run backtest dataset                    # dataset para IA (tabela + CSV)
bun run backtest ficha XPML11               # ficha de decisão do fundo
```

Fontes: COTAHIST da B3, informes da CVM (com a data de entrega), proventos
do statusinvest, CDI/Selic/IPCA do BCB e juro real da NTN-B do Tesouro. Tudo
fica em `data/backtest.db` (fora do git).

## Testes

Os testes são de caracterização: as respostas do statusinvest/fundamentus ficam
gravadas em `tests/fixtures` e a saída esperada em `tests/golden/data`. Servem para
refatorar o scraping sem mudar o resultado. Se o statusinvest mudar o layout, rode
`bun run fixtures:record` e depois `bun run test:update`, e revise o diff.

---
# Simular Investimento ao longo do tempo

## Problematização
Como simular um investimento ao longo do tempo?

## Limitações
- Não considera inflação
- Não considera impostos
- Não considera aportes
- Dados de entrada dos últimos 5 anos (Tempo máximo de simulação)

## Requisitos

- [ ] Método para simular investimento ao longo do tempo
- [ ] Método para calcular o valor futuro do investimento (reconsiderar)
- [ ] Método para calcular o valor presente do investimento
- [ ] Método para calcular o rendimento do investimento
- [ ] Método para calcular o rendimento do investimento com reinvestimento de dividendos
- [ ] Método para calcular o rendimento do investimento com reinvestimento de dividendos e aportes mensais
- [ ] Comparar com a inflação
- [ ] Comparar com a poupança
- [ ] Comparar com o CDI
- [ ] Comparar com o IBOVESPA
- [ ] Comparar com o S&P500
----
