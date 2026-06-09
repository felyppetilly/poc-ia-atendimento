---
baseline_commit: aa6e2a746414bd9f2b9d981817a3dbd43a776ec2
---

# Story 1.1: Inicialização do projeto e healthcheck na VPS

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Felyppe (desenvolvedor da POC),
I want um scaffold TypeScript/Node com servidor Express, configuração validada e endpoint de saúde,
so that eu tenha uma base implantável na VPS (via Easypanel) sobre a qual todas as funcionalidades serão construídas.

## Acceptance Criteria

**AC1 — Scaffold e dependências instaladas**
**Given** o repositório recém-inicializado conforme o comando do starter (Node 24 LTS, ESM)
**When** rodo a inicialização do projeto
**Then** `package.json` tem `"type": "module"`, script `dev` = `tsx watch src/server.ts`, e as dependências instaladas são: `@openai/agents`, `openai`, `express`, `zod`, `@supabase/supabase-js`, `dotenv`, `@azure/identity`, `@microsoft/microsoft-graph-client` (runtime) + `typescript`, `tsx`, `@types/node`, `@types/express` (dev)
**And** existe `tsconfig.json` configurado para ESM (`module`/`moduleResolution` = `nodenext`, target ES2022+).

**AC2 — Servidor sobe sem erros**
**Given** o scaffold instalado
**When** rodo `npm run dev` (`tsx watch src/server.ts`)
**Then** o servidor Express sobe sem erros e loga a porta em que está escutando.

**AC3 — Config validada por zod (fail-fast)**
**Given** o serviço em inicialização
**When** `src/config.ts` lê e valida as variáveis de ambiente via zod
**Then** a inicialização falha rápido com mensagem clara se uma variável **obrigatória para bootar** estiver ausente/inválida
**And** `config.ts` é a **única fonte** de configuração (nenhum `process.env.X` espalhado pelo código).

**AC4 — `.env.example` e `.gitignore`**
**Given** o projeto
**When** inspeciono a raiz
**Then** existe `.env.example` documentando **todas** as variáveis previstas para a POC (segredos OpenAI/Graph/Evolution, `LUCAS_WHATSAPP`, `LUCAS_USER_ID`, endereço do escritório, janela comercial, máx. de slots, `PORT`)
**And** `.env` está no `.gitignore` (já está — confirmar, não recriar o arquivo do zero).

**AC5 — Healthcheck**
**Given** o serviço em execução
**When** faço `GET /health`
**Then** recebo `200` com corpo simples de status (ex.: `{ "status": "ok" }`).

**AC6 — Dockerfile para Easypanel**
**Given** a meta de publicar na VPS Hostinger via Easypanel
**When** inspeciono a raiz
**Then** existe um `Dockerfile` (base Node 24) que roda o serviço **executando `tsx` direto, sem build step** (consistente com a POC), expõe a porta do Express (lida de `PORT`) e o Easypanel cuida de build, SSL/HTTPS e proxy reverso (subdomínio → `/webhook`).

## Tasks / Subtasks

- [x] **Task 1 — Inicializar o projeto Node/TS (ESM)** (AC: 1)
  - [x] Na raiz do repo (já é um git repo — **não** rodar `git init` nem `mkdir poc-ia-atendimento`; criar os arquivos na raiz atual), rodar `npm init -y` e `npm pkg set type=module`
  - [x] Instalar runtime: `npm install @openai/agents openai express zod @supabase/supabase-js dotenv @azure/identity @microsoft/microsoft-graph-client`
  - [x] Instalar dev: `npm install -D typescript tsx @types/node @types/express`
  - [x] Criar `tsconfig.json` (`npx tsc --init`) e ajustar para ESM: `"module": "nodenext"`, `"moduleResolution": "nodenext"`, `"target": "ES2022"`, `"strict": true`, `"esModuleInterop": true`, `"skipLibCheck": true`, `"types": ["node"]`
  - [x] Adicionar script em `package.json`: `"dev": "tsx watch src/server.ts"` (e opcional `"start": "tsx src/server.ts"` para o container)
- [x] **Task 2 — `src/config.ts` (env validado por zod, fail-fast)** (AC: 3, 4)
  - [x] Carregar `.env` com `dotenv` no topo (`import 'dotenv/config'`) **antes** de validar
  - [x] Definir um schema zod com todas as variáveis da POC; **apenas `PORT` (com default) é obrigatória para bootar nesta story** — segredos de OpenAI/Graph/Evolution ficam **opcionais por enquanto** (serão promovidos a obrigatórios nas stories que os consumirem — 1.2/1.3/2.1). Ver Dev Notes "Estratégia de config incremental".
  - [x] Em caso de erro de validação, imprimir mensagem clara (campos faltando/ inválidos) e `process.exit(1)`
  - [x] Exportar um objeto `config` tipado (camelCase) como única fonte
- [x] **Task 3 — `.env.example`** (AC: 4)
  - [x] Criar `.env.example` na raiz com **todas** as chaves previstas (ver Dev Notes "Variáveis de ambiente"), com valores placeholder/comentados
  - [x] Confirmar que `.gitignore` já ignora `.env` e mantém `!.env.example` (já configurado — não recriar)
- [x] **Task 4 — `src/server.ts` (Express + `/health`)** (AC: 2, 5)
  - [x] Bootstrap Express, `app.use(express.json())`
  - [x] `GET /health` → `res.status(200).json({ status: 'ok' })`
  - [x] `app.listen(config.port, ...)` logando `[server] escutando na porta ${config.port}` com prefixo de contexto (padrão de logging da arquitetura)
  - [x] (Opcional, prepara 1.3) deixar um `POST /webhook` placeholder que responde `200` — **não** obrigatório nesta story; se incluir, manter trivial
- [x] **Task 5 — `Dockerfile` (Node 24, sem build)** (AC: 6)
  - [x] Base `node:24-slim`; `WORKDIR /app`; copiar `package*.json`; `npm ci` (ou `npm install` se não houver lockfile ainda); copiar o resto; `EXPOSE` a porta; `CMD ["npx", "tsx", "src/server.ts"]`
  - [x] Garantir que a porta exposta = `PORT` que o Express usa (Easypanel mapeia o subdomínio para essa porta)
- [x] **Task 6 — Verificação manual (demo da story)** (AC: 2, 3, 5)
  - [x] `npm run dev` sobe sem erro
  - [x] `curl http://localhost:<PORT>/health` → `200 {"status":"ok"}`
  - [x] Remover/renomear `.env` temporariamente e confirmar que (a) sem `PORT` o default funciona; (b) tornando uma var obrigatória ausente, o processo falha com mensagem clara (teste o fail-fast)

## Dev Notes

### Contexto crítico (greenfield — primeira story)
- O repositório **já existe** como git repo (branch `main`) e já contém os artefatos BMad em `_bmad-output/`, `docs/`, `.claude/`. **Não** rode `git init`, **não** crie subpasta `poc-ia-atendimento/` — o comando do starter na arquitetura assume diretório novo, mas aqui os arquivos do app (`package.json`, `tsconfig.json`, `src/`, `Dockerfile`, `.env.example`) vão **na raiz atual do repo**. [Source: estado atual do repo verificado — não há `package.json`/`src/`/`Dockerfile`]
- `.gitignore` **já existe** e já cobre `.env`, `.env.*` (com `!.env.example`), `node_modules/`, `dist/`, `build/`, logs e `.claude/`. **Não recriar** — apenas confirmar. [Source: .gitignore]

### Stack e versões [Source: architecture.md#Selected Starter / #Starter Template Evaluation]
- **Runtime:** TypeScript 5+, Node.js **24 LTS**, **ESM** (`"type": "module"`). Sem transpile na POC — `tsx` executa `.ts` direto, em dev (`tsx watch`) e em prod (container roda `tsx`). [Source: architecture.md#Structure Patterns linha "Sem transpile na POC"]
- **Comando do starter (referência):** [Source: architecture.md#Initialization Command / #Implementation Handoff]
  ```bash
  npm init -y && npm pkg set type=module
  npm install @openai/agents openai zod express @supabase/supabase-js dotenv @azure/identity @microsoft/microsoft-graph-client
  npm install -D typescript tsx @types/node @types/express
  npx tsc --init
  ```
- **Por que instalar `@openai/agents`, `@azure/identity`, `@microsoft/microsoft-graph-client` já agora** sendo que o código deles só entra em stories futuras: o épico define o scaffold com o conjunto completo de deps na Story 1 para fixar a base implantável de uma vez. Nesta story **não** se escreve código de agente/Graph — só se instala. [Source: epics.md#Additional Requirements "Starter / scaffold (Epic 1, Story 1)"]
- **`tsx` + ESM:** com `tsx`, imports relativos podem ser sem extensão (o runner resolve). Manter simples; não há build `tsc` na POC. Se um dia houver build com `nodenext`, imports relativos precisariam de `.js` — fora de escopo agora.

### Estratégia de config incremental (decisão importante — evita travar o boot)
- A AC pede `config.ts` que falha rápido se faltar var **obrigatória**. Mas os segredos de OpenAI/Graph/Evolution **ainda não existem** (Graph depende da Story 2.1; Evolution/OpenAI entram em 1.3/1.4). Se `config.ts` exigir todos agora, o scaffold **não sobe** e a story não é demonstrável — contradizendo seu objetivo ("base implantável").
- **Padrão a seguir:** schema zod com **todas** as chaves declaradas, mas só as necessárias para bootar (`PORT`, `NODE_ENV`) como required (com defaults sensatos); as demais como `.optional()` **por enquanto**. Cada story futura promove suas chaves a obrigatórias quando passa a consumi-las. Documentar esse contrato com um comentário no `config.ts`.
- Sugestão de defaults: `PORT` default `3000`, `NODE_ENV` default `development`, `BUSINESS_HOURS_START` `9`, `BUSINESS_HOURS_END` `18`, `MAX_SLOTS` `3`, `LUCAS_WHATSAPP` default `+5511985303959`, `OFFICE_ADDRESS` default `Rua Maria Máximo 153, Ponta da Praia, Santos/SP`. [Source: epics.md FR-9, FR-4; architecture.md#Technical Constraints]

### Variáveis de ambiente (para `.env.example` — documentar todas) [Source: architecture.md#Authentication & Security, #Infrastructure & Deployment; epics.md#Additional Requirements]
- **Servidor:** `PORT`, `NODE_ENV`
- **OpenAI:** `OPENAI_API_KEY`
- **Evolution API:** `EVOLUTION_BASE_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `WEBHOOK_SECRET` (segredo compartilhado validado no `POST /webhook`)
- **Supabase:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, nunca no frontend)
- **Microsoft Graph (app-only):** `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `LUCAS_USER_ID`
- **Negócio:** `LUCAS_WHATSAPP` (default +55 11 98530-3959), `OFFICE_ADDRESS` (Rua Maria Máximo 153, Ponta da Praia, Santos/SP), `BUSINESS_HOURS_START` (9), `BUSINESS_HOURS_END` (18), `MAX_SLOTS` (3), `TIMEZONE` (`America/Sao_Paulo`)
- **Nomes exatos das chaves são sugestões** — manter consistentes com o que as stories futuras vão consumir; usar `UPPER_SNAKE_CASE` (convenção da arquitetura).

### Estrutura de arquivos alvo (criar só o que esta story precisa)
Nesta story criamos apenas a **casca**: `package.json`, `tsconfig.json`, `Dockerfile`, `.env.example`, `src/server.ts`, `src/config.ts`. Os demais diretórios (`agent/`, `domain/`, `integrations/`, `repos/`, `webhook/`, `supabase/migrations/`) **serão criados nas stories que os usam** — não criar arquivos vazios/placeholder agora. [Source: architecture.md#Complete Project Directory Structure]
```
poc-ia-atendimento/ (= raiz do repo atual)
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
├── .gitignore            # já existe
└── src/
    ├── server.ts         # Express + GET /health  (POST /webhook vem na 1.3)
    └── config.ts         # env via zod (única fonte)
```

### Convenções obrigatórias [Source: architecture.md#Naming Patterns, #Enforcement Guidelines]
- Arquivos em `kebab-case` (`config.ts`, `server.ts`).
- Config/env só via `config.ts` — **nunca** `process.env.X` direto fora dele (anti-pattern explícito da arquitetura).
- Logging: `console` com prefixo de contexto, ex. `[server]`, `[webhook]`, `[config]`.
- Constantes de env em `UPPER_SNAKE_CASE`; objeto `config` exportado em `camelCase`.

### Deploy / Easypanel [Source: architecture.md#Infrastructure & Deployment; memória do projeto poc-deploy-easypanel]
- Host: **mesma VPS Hostinger** da Evolution API, gerenciada pelo **Easypanel** (Docker + Traefik por baixo). O Easypanel provê **proxy reverso, SSL/HTTPS (Let's Encrypt) e domínio automaticamente** — **não** configurar nginx/Caddy/PM2 na mão.
- O app será criado no Easypanel a partir do repo GitHub `github.com/felyppetilly/poc-ia-atendimento`; build do `Dockerfile` automático a cada push. **Segredos/env vars vão na tela Environment do Easypanel**, não em `.env` no servidor.
- O `Dockerfile` precisa apenas: imagem Node 24, instalar deps, `EXPOSE` a porta, rodar `tsx`. O Easypanel mapeia subdomínio → porta exposta → `/webhook` (cadastrado na Evolution numa story futura).
- **Felyppe não domina infra/devops** — manter o Dockerfile simples e padrão; se houver passo manual no Easypanel, descrever em linguagem de receita. [Source: memória user-infra-skill]

### Testing standards
- A POC **não tem testes automatizados** como meta — validação é por demo ponta a ponta. [Source: architecture.md "Testes automatizados não são meta da POC"]
- Verificação desta story = manual (Task 6): server sobe, `/health` responde 200, fail-fast da config funciona. Se quiser, o padrão futuro seria `*.test.ts` + Vitest (não criar agora).

### Pegadinhas a evitar
- ❌ Exigir todos os segredos na config agora → trava o boot da story (ver "Estratégia de config incremental").
- ❌ Recriar `.gitignore` / rodar `git init` / criar subpasta `poc-ia-atendimento/`.
- ❌ Criar diretórios/arquivos placeholder das stories futuras (`agent/`, `integrations/`, etc.).
- ❌ Adicionar build step `tsc` no Dockerfile — a POC roda `tsx` direto, sem transpile.
- ❌ `process.env.X` espalhado — tudo via `config.ts`.
- ❌ Markdown pesado nas respostas HTTP — `/health` é JSON simples (regra de formato é para WhatsApp, mas mantenha respostas enxutas).

### Project Structure Notes
- Alinhado com a árvore da arquitetura; esta story entrega apenas a raiz + `src/server.ts` + `src/config.ts` + `Dockerfile` + `.env.example`. Sem variâncias/conflitos detectados. A única adaptação ao documento de arquitetura: o starter cita `mkdir poc-ia-atendimento && cd` — aqui o repo já existe, então os arquivos vão na raiz atual (variância benigna, registrada acima).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] — user story + ACs originais
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] — scaffold/deps, deploy, config externalizada
- [Source: _bmad-output/planning-artifacts/architecture.md#Selected Starter] — stack, Node 24 LTS, ESM, comando do starter
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure & Deployment] — Easypanel, Dockerfile, sem PM2/nginx
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns / #Enforcement Guidelines] — convenções, anti-patterns
- [Source: _bmad-output/planning-artifacts/architecture.md#Complete Project Directory Structure] — estrutura alvo
- [Source: .gitignore] — já cobre `.env` e `node_modules`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npx tsc --noEmit` → exit 0 (sem erros de tipo; zod 4 + express 5 + nodenext OK).
- `npx tsx src/server.ts` → loga `[server] escutando na porta 3000 (env: development)`.
- `curl http://localhost:3000/health` → `200 {"status":"ok"}`.
- Fail-fast: `NODE_ENV=banana npx tsx src/server.ts` → mensagem clara `[config] ❌ ... NODE_ENV: Invalid option...` + exit code 1.
- Default de boot: `env -u PORT -u NODE_ENV npx tsx src/server.ts` → sobe na porta 3000 (defaults aplicados).

### Completion Notes List

- Scaffold criado na **raiz do repo existente** (sem `git init`, sem subpasta `poc-ia-atendimento/`), conforme orientado nas Dev Notes.
- `package.json` com `"type": "module"`, scripts `dev` (`tsx watch src/server.ts`) e `start` (`tsx src/server.ts`). Todas as deps de runtime e dev instaladas; gerou `package-lock.json` (necessário para `npm ci` no Dockerfile).
- Versões resolvidas (mais recentes na data): express 5.x, zod 4.x, @openai/agents 0.11.x — o código de config/server é compatível.
- **Config incremental** aplicada: só `PORT`/`NODE_ENV` exigidas para bootar (com default); segredos OpenAI/Graph/Evolution/Supabase ficam `.optional()` e serão promovidos nas stories 1.2/1.3/1.4/2.1. Comentário no `config.ts` documenta esse contrato.
- `config.ts` é a **única fonte** de env (nenhum `process.env.X` fora dele); objeto `config` em camelCase.
- Imports relativos usam extensão `.js` (`./config.js`) por exigência do `module: nodenext` — o `tsx` resolve para o `.ts` em runtime.
- Adicionado `.dockerignore` (companheiro do Dockerfile) para não copiar `node_modules`/`.env`/artefatos BMad para a imagem — mantém a imagem enxuta e evita vazar segredos.
- `.gitignore` já cobria `.env`/`node_modules` — apenas confirmado, não recriado.
- POC sem testes automatizados (decisão de arquitetura): verificação por demo manual (Task 6), toda registrada no Debug Log acima.

### File List

- `package.json` (novo) — ESM, scripts dev/start, dependências
- `package-lock.json` (novo) — lockfile gerado pela instalação
- `tsconfig.json` (novo) — ESM nodenext, target ES2022, strict
- `src/config.ts` (novo) — env validado por zod (fail-fast), fonte única
- `src/server.ts` (novo) — Express + `GET /health`
- `.env.example` (novo) — todas as variáveis previstas da POC
- `Dockerfile` (novo) — Node 24-slim, sem build, roda `tsx`
- `.dockerignore` (novo) — exclui node_modules/.env/artefatos da imagem
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificado) — status da story 1.1
- `_bmad-output/implementation-artifacts/1-1-inicializacao-do-projeto-e-healthcheck-na-vps.md` (modificado) — frontmatter, checkboxes, Dev Agent Record, status

## Change Log

| Data       | Versão | Descrição                                                       | Autor   |
|------------|--------|-----------------------------------------------------------------|---------|
| 2026-06-08 | 0.1    | Scaffold TS/Node ESM, config zod fail-fast, /health, Dockerfile | Amelia (dev) |
