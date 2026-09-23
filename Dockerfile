FROM oven/bun:1.4.2-slim

WORKDIR /app

# Dependências primeiro, para aproveitar o cache de camadas do Docker
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY src ./src
COPY assets ./assets

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# O Bun executa TypeScript direto: não há etapa de build
USER bun
CMD ["bun", "src/server.ts"]
