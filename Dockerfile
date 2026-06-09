# POC IA Atendimento — imagem simples para Easypanel (Hostinger).
# Sem build step: a POC roda TypeScript direto via `tsx` (sem transpile/tsc).
# O Easypanel cuida de build da imagem, SSL/HTTPS e proxy reverso.
FROM node:24-slim

WORKDIR /app

# Instala dependências primeiro (camada cacheável)
COPY package*.json ./
RUN npm ci

# Copia o restante do código
COPY . .

# Porta do Express (lida de PORT no config.ts; default 3000).
# O Easypanel mapeia o subdomínio para esta porta.
ENV PORT=3000
EXPOSE 3000

# Roda o servidor executando tsx direto (sem build)
CMD ["npx", "tsx", "src/server.ts"]
