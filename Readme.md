# IbovespaData

API que consome o histórico de 5 anos de preços e dividendos de ações brasileiras
(statusinvest / fundamentus) e de FIIs (brapi.dev), pontua os papéis pelos métodos
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