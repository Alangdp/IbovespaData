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

Docker: `docker build -t ibovespadata .` gera a imagem da API (a API precisa de
`REDIS_HOST` apontando para o Redis).

## Rotas

`GET /stock/:ticker` (e `/price`, `/dividends`, `/indicators`, `/graham`, `/history`,
`/dividends/history`), `GET /bazin/:ticker`, `GET /graham/:ticker`,
`GET /simulation/:ticker`, `GET /fundos` (`?tickers=A,B`), `GET /fundos/:ticker` e
imagens em `/images/avatar/*` e `/images/logos/*`.

`GET /fundos/:ticker/taxas` mostra o cálculo da taxa de administração trimestre a
trimestre.

Os campos `gestora`, `taxa_administracao` e `limite_distribuicao_respeitado` vêm
dos dados abertos da CVM (informes mensal, trimestral e anual de todos os FIIs).
Um job diário (6h) consulta o ETag dos zips e só baixa quando a CVM republica
(em geral 1x por semana); para carregar na hora: `bun run cvm:refresh` (ou
`bun run cvm:refresh -- --force`).

O `ltv_medio` (fundos de Papel e Híbrido) é lido do relatório gerencial mais
recente no FNET, procurando "LTV médio" ou "LTV consolidado" no texto do PDF;
fica `null` quando a gestora não publica a média. Como o FNET é lento (de 2 s a
mais de 1 min por PDF), a leitura roda numa fila em segundo plano: a primeira
consulta do fundo volta sem LTV e as seguintes já trazem o valor (cache de 7
dias).

As rotas `/fundos` estão documentadas em `openapi.yaml`: o `data` segue o schema
`Fundo` do contrato do comparador de FIIs (`fii-api.yaml`), com campos extras
marcados como "Extra". Um teste em `tests/http/routes.test.ts` falha se a
resposta e o schema divergirem.

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