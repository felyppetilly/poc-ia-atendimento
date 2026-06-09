---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-06-08'
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-POC_IA_Atendimento-2026-06-07/prd.md'
  - '_bmad-output/planning-artifacts/briefs/brief-POC_IA_Atendimento-2026-06-07/brief.md'
  - 'docs/evolution-api-readme-pt.md'
workflowType: 'architecture'
project_name: 'POC_IA_Atendimento'
user_name: 'Felyppe Tilly'
date: '2026-06-08'
decisions:
  calendar_provider: 'Microsoft (Graph API) — substitui Google Calendar do PRD/Brief, para a POC'
mcp_available:
  - 'sbos-consulta-docs-microsoft (Microsoft Graph / Learn)'
  - 'sbos-consulta-docs-openai (OpenAI API / Agents SDK)'
  - 'sbos-consulta-docs-supabase (Supabase)'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
9 FRs em 4 grupos:
- Recepção & Triagem (FR-1 saudação, FR-2 triagem dos 4 tipos de demanda, FR-3 coleta conversacional de nome/e-mail/resumo/preferência). Implicação: agente conversacional multi-turno com estado por cliente; classificação de intenção; validação de e-mail.
- Agendamento (FR-4 formato online/presencial, FR-5 consulta de disponibilidade + oferta de até 3 slots seg-sex 9–18h, FR-6 confirmação). Implicação: integração de leitura de calendário; lógica de slots; tratamento de corrida oferta↔confirmação.
- Convite & Briefing (FR-7 criação de evento travando o slot com Cliente+Lucas; FR-8 briefing estruturado anexado ao evento). Implicação: escrita no calendário; geração de link de videochamada (Teams); envio de convite por e-mail; geração de texto estruturado.
- Fallback (FR-9 notificar Lucas por WhatsApp quando fora de escopo). Implicação: detecção de fora-de-escopo; segundo caminho de envio via Evolution.

**Non-Functional Requirements:**
- Guardrail jurídico (crítico): IA nunca emite opinião jurídica; identifica-se como assistente automatizado.
- Consistência de agenda (SM-2): nenhum slot ocupado ofertado/criado; tratar reoferta se o slot expirar entre oferta e confirmação.
- Disponibilidade: responde 24/7; agendamento restrito a seg-sex 9h–18h, blocos de 1h.
- Latência percebida: "poucos segundos" para responder (ASSUMPTION).
- Privacidade (LGPD): tratamento controlado na POC; uso/retenção formais ficam para produção.
- Custo: inferência OpenAI por token; volume de demo (~5 contatos/dia).
- Maturidade: é DEMO — sem requisitos de HA, escala, volume ou monitoramento de produção.

**Scale & Complexity:**
- Primary domain: backend / serviço de agente de IA orientado a integrações (sem UI própria; canal é o WhatsApp)
- Complexity level: média
- Estimated architectural components: ~6 (ingestão de webhook WhatsApp, orquestrador do agente/LLM, store de estado de conversa, adaptador Microsoft Graph/calendário, gerador de briefing, roteador de fallback) + configuração

### Technical Constraints & Dependencies

- Evolution API: canal WhatsApp (webhook entrante + API de envio); autenticação por header `apikey` + token por instância; suporta validação de assinatura de webhook. Conexão Baileys (gratuita) ou Cloud API oficial.
- OpenAI: inteligência conversacional (saudação, triagem, coleta, briefing); custo por token.
- Microsoft Graph (Outlook Calendar): consulta de disponibilidade, criação de evento, convite por e-mail, link Teams (online). Requer registro de app no Entra ID + permissões Graph. ATENÇÃO: link de reunião Teams via Graph normalmente exige conta work/school (M365) — a confirmar na decisão de auth/agenda.
- Conta Microsoft do Felyppe: provisória na POC.
- Dados de configuração: número do WhatsApp do Lucas (+55 11 98530-3959, configurável), endereço do escritório (Rua Maria Máximo 153, Ponta da Praia, Santos/SP), janela comercial, nº máximo de slots.

### Cross-Cutting Concerns Identified

- Estado/memória de conversa multi-turno por número de telefone (persistência entre mensagens).
- Orquestração do agente com tool-calling (calendário, envio WhatsApp, fallback).
- Guardrail jurídico aplicado de forma transversal (prompt + possível verificação de saída).
- Consistência/idempotência de agendamento (corrida oferta↔confirmação; evitar dupla marcação).
- Tratamento de erros de integrações externas (falha de agenda/WhatsApp degrada a demo).
- Configuração externalizada (segredos de API, número do Lucas, parâmetros de negócio).
- Privacidade dos dados pessoais coletados (LGPD — controlado na POC).

## Starter Template Evaluation

### Primary Technology Domain

Backend / serviço de agente de IA orientado a integrações (TypeScript/Node). Sem UI própria — o canal é o WhatsApp via webhook da Evolution API. Logo, NÃO se aplica um starter full-stack/frontend (Next.js, T3, etc.).

### Technical Preferences (definidas na discovery)

- Linguagem/Runtime: TypeScript / Node.js 24 LTS
- Orquestração do agente: OpenAI Agents SDK (`@openai/agents`)
- Estado/Dados: Supabase / Postgres
- Hospedagem: VPS própria do Felyppe (mesma onde a Evolution API já está hospedada → URL pública estável, sem túnel)

### Starter Options Considered

- **OpenAI Agents SDK Quickstart (TS)** — guia oficial code-first para o núcleo do agente (define agent, tools, handoffs, guardrails). É o "starter" mais próximo do que precisamos; instala `@openai/agents`. (https://developers.openai.com/api/docs/guides/agents/quickstart)
- **Boilerplates full-stack (Next.js / T3 / RedwoodJS)** — descartados: trazem frontend/SSR/roteamento de UI que esta POC não usa.
- **Supabase Edge Functions** — possível host do webhook, mas Deno + cold start + limite de execução atrapalham um agente conversacional com chamadas longas a LLM/Graph. Descartado como host; Supabase fica como camada de dados (Postgres), não como runtime.
- **Scaffold mínimo TS/Node (escolhido)** — projeto Node enxuto com Express para o webhook + Agents SDK + clientes Supabase/Graph. Roda na mesma VPS onde a Evolution já está hospedada.

### Selected Starter: Scaffold mínimo TypeScript/Node (Node 24 LTS) + OpenAI Agents SDK

**Rationale for Selection:**
A POC é um serviço backend simples (1 webhook + orquestração). Um scaffold mínimo dá controle total, zero peso supérfluo, e roda na VPS existente (mesma máquina da Evolution → URL pública estável, sem túnel). O Agents SDK cobre o loop de tools, estado/sessions, handoffs (fallback) e guardrails (limite jurídico) sem código de orquestração manual.

**Initialization Command:**

```bash
mkdir poc-ia-atendimento && cd poc-ia-atendimento
npm init -y
npm pkg set type=module
npm install @openai/agents openai zod express @supabase/supabase-js dotenv
npm install -D typescript tsx @types/node @types/express
npx tsc --init
# dev: npx tsx watch src/server.ts
```
(Dependências de auth/Microsoft Graph serão fixadas na etapa de decisões — ver Architectural Decisions.)

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript 5+, Node.js 24 LTS, ESM (`"type": "module"`). Execução em dev via `tsx watch` (sem build na POC).

**Web/Webhook Layer:**
Express — endpoint único `POST /webhook` para receber eventos da Evolution API. Leve, ubíquo, mesma família de framework que a própria Evolution.

**Agent Orchestration:**
OpenAI Agents SDK (`@openai/agents`) — definição de agente, function tools (zod), handoffs e guardrails. Núcleo da inteligência conversacional.

**Data/State:**
`@supabase/supabase-js` — estado de conversa por número de WhatsApp + dados coletados.

**Config:**
`dotenv` — segredos (chaves Evolution/OpenAI/Graph), número do Lucas, parâmetros de negócio externalizados.

**Code Organization (proposto):**
`src/server.ts` (webhook), `src/agent/` (agente, tools, guardrails), `src/integrations/` (evolution, graph, supabase), `src/config.ts`. Detalhado na arquitetura.

**Note:** A inicialização do projeto com esse scaffold deve ser a primeira story de implementação.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Conta Microsoft 365 (work/school) — obrigatória p/ free/busy + Teams (MSA pessoal não suporta). Via gratuita: Microsoft 365 Developer Program (tenant E5 grátis, renovável); Felyppe = admin do tenant.
- Auth Microsoft Graph: app-only client credentials, permissão Application `Calendars.ReadWrite`.
- Modelo de dados de estado de conversa (Supabase/Postgres).
- Modelo de processamento do webhook da Evolution (ack rápido + processamento assíncrono, serializado por telefone).

**Important Decisions (Shape Architecture):**
- Desenho do agente (Agents SDK): 1 agente + function tools + guardrail jurídico.
- Estratégia de consistência de agenda (fonte da verdade = calendário; re-checagem no confirm).
- Timezone fixo America/Sao_Paulo p/ toda a lógica de slots.

**Deferred Decisions (Post-MVP / verificar na implementação):**
- Nome exato do modelo OpenAI (confirmar via MCP openaiDeveloperDocs no momento de codar; escolher modelo atual com bom tool-calling/custo).
- Debounce de mensagens curtas consecutivas do WhatsApp (refinamento de UX; opcional na POC).
- Lembretes/reagendamento (fora do MVP por PRD).

### Data Architecture

**Banco:** Supabase (PostgreSQL). Acesso pelo backend com a **service role key** (serviço server-only). Confirmado na doc oficial ([Securing your data](https://supabase.com/docs/guides/database/secure-data)): secret/service role key **bypassa RLS**, **nunca** vai ao frontend, e deve ser tratada como segredo (env var sensível, nunca hardcoded).

**RLS (defense-in-depth):** mesmo a service role bypassando RLS, a doc ([Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)) recomenda **habilitar RLS em todas as tabelas do schema `public`** (`alter table ... enable row level security;`). Sem policies, o acesso via chave pública fica bloqueado por padrão e só a service role (backend) opera. As migrations já criam as tabelas com RLS ON. Opcional p/ endurecer ainda mais: **desabilitar a Data API** do projeto (o serviço só acessa server-side).

**Tabelas (POC):**
- `conversations` — `id`, `phone` (unique, = chave da conversa), `phase`/`status` (ex.: greeting, triaging, collecting, scheduling, confirming, scheduled, escalated), `demand_type` (4 tipos), `meeting_format` (online/presencial), `collected` (jsonb: nome, email, resumo, preferência), `created_at`, `updated_at`.
- `messages` — `id`, `conversation_id`, `role`, `content`, `created_at` (histórico p/ alimentar o contexto do agente entre turnos).
- `appointments` — `id`, `conversation_id`, `start`, `end` (America/Sao_Paulo), `format`, `graph_event_id`, `join_url` (Teams) ou endereço, `status`, `created_at`.

**Validação:** zod (já no stack) p/ inputs das tools e dos dados coletados (e-mail validado em formato — FR-3).
**Migrations:** SQL via Supabase CLI/MCP.
**Estado do agente:** a cada webhook entrante, carrega `conversations` + `messages` recentes pelo `phone`, roda o agente, persiste a resposta e o novo estado. (Sem cache dedicado; volume da POC não exige Redis.)

### Authentication & Security

**Microsoft Graph (app-only / client credentials):**
- App registration no Microsoft Entra ID (tenant M365 do Felyppe, admin).
- Permissão **Application: `Calendars.ReadWrite`** + admin consent (Felyppe é admin).
- Token via `@azure/identity` `ClientSecretCredential` → `@microsoft/microsoft-graph-client` (`TokenCredentialAuthenticationProvider`). Sem refresh token interativo.
- Chamadas sobre `/users/{LUCAS_USER_ID}/calendar/...`.
- NÃO requer `OnlineMeetings.ReadWrite.All` nem application access policy (Teams vem via Calendar API).

**Evolution API:**
- Webhook entrante protegido por segredo compartilhado (header `apikey`/token) validado no `POST /webhook`. Evolution e o serviço estão na mesma VPS.
- Envio de mensagens (resposta ao cliente e fallback ao Lucas) via API da Evolution autenticada por `apikey` da instância.

**Segredos:** `.env` na VPS (chaves OpenAI, client secret do Graph, apikey Evolution, IDs/telefones). Nunca versionados.
**OpenAI:** API key server-side.
**LGPD (POC):** dados pessoais restritos ao banco da demo; tratamento formal fica p/ produção.

### API & Communication Patterns

**Inbound:** Evolution API → `POST /webhook` (eventos de mensagem recebida). O endpoint **responde 200 imediatamente** e processa o turno de forma **assíncrona** (evita timeout/retry da Evolution).
**Serialização por conversa:** mensagens do mesmo `phone` processadas em ordem (lock/fila simples em memória — instância única na POC) p/ evitar corrida de estado.
**Outbound:** cliente recebe resposta via endpoint de envio da Evolution; fallback (FR-9) envia ao número do Lucas (+55 11 98530-3959, configurável) pela mesma API.
**Convite por e-mail (FR-7):** ao criar o `event` com `attendees` (e-mail do cliente + Lucas), o Exchange/Graph dispara os convites automaticamente.
**Tratamento de erro:** falha de Graph/Evolution é capturada; o agente responde com cortesia e, se necessário, aciona fallback ao Lucas. É demo — sem retry/observabilidade de produção.

### Agent Architecture (OpenAI Agents SDK)

**1 agente principal "Pré-atendimento"** com instruções que impõem a ordem dos FRs (saúda → tria → coleta nome/e-mail/resumo → formato → oferta de slots → confirma → cria convite).
**Function tools (zod):**
- `getAvailability(prefs)` → `getSchedule` no calendário do Lucas + geração própria de Slots (seg-sex 9–18h, blocos 1h, máx. 3, prioriza preferência). Calendário é a **fonte da verdade**.
- `createAppointment(slot, dadosCliente, formato)` → cria `event` (online: `isOnlineMeeting+teamsForBusiness` → `joinUrl`; presencial: endereço do escritório), attendees = cliente + Lucas, body = **Briefing** (FR-8). **Re-valida** a disponibilidade do slot imediatamente antes de criar (trata corrida oferta↔confirmação — FR-6).
- `escalateToLucas(resumo, contato)` → notifica o Lucas no WhatsApp e marca `status=escalated` (FR-9).
**Guardrail jurídico (crítico):** guardrail de saída + instrução de sistema — a IA nunca emite opinião/orientação jurídica e sempre se identifica como assistente automatizado (§10.1). Diante de pedido de orientação, redireciona p/ agendamento ou fallback.
**Tracing do Agents SDK** habilitado p/ depurar a demo.

### Infrastructure & Deployment

**Host:** mesma VPS (Hostinger) gerenciada pelo **Easypanel**, onde a Evolution API já roda como serviço. O Easypanel (Docker + Traefik por baixo) provê **proxy reverso, SSL/HTTPS (Let's Encrypt) e mapeamento de domínio automaticamente** — sem nginx/Caddy/PM2 configurados na mão.
**Runtime / processo:** Node 24 LTS **conteinerizado** (Dockerfile fixando a versão); o Easypanel gerencia build, ciclo de vida e restart do container ao lado da Evolution.
**Deploy:** app criado no Easypanel a partir do repositório GitHub (`github.com/felyppetilly/poc-ia-atendimento`); build automático a cada push (ou manual). **Segredos/env vars** configurados na tela Environment do Easypanel (não em `.env` no servidor). Subdomínio com SSL automático → webhook em `https://<subdominio>/webhook`, cadastrado na instância da Evolution.
**Rede:** Evolution e o serviço, no mesmo Easypanel, comunicam-se pela rede interna do Docker.
**Timezone:** America/Sao_Paulo em toda a lógica de slots e nas chamadas Graph (`Prefer: outlook.timezone`, `dateTime`+`timeZone`).
**CI/CD:** não necessário p/ POC (build no Easypanel a partir do GitHub). Logging em console + tracing OpenAI.

### Decision Impact Analysis

**Implementation Sequence:**
1. Provisionar tenant M365 Developer + app registration (Entra ID) + permissão `Calendars.ReadWrite` + admin consent.
2. Scaffold do projeto (step Starter) + `.env` + clientes (Graph, Supabase, Evolution).
3. Migrations Supabase (conversations/messages/appointments).
4. Webhook + serialização por telefone + envio Evolution.
5. Agente + tools (availability, appointment, escalate) + guardrail.
6. Teste ponta a ponta da demo (UJ-1 e UJ-2).

**Cross-Component Dependencies:**
- A conta M365 destrava `getAvailability` e o link Teams — bloqueia FR-4/5/7.
- `createAppointment` depende de `getAvailability` (mesma fonte de verdade) p/ não dar dupla marcação.
- Guardrail jurídico é transversal a todos os turnos do agente.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

Pontos de conflito relevantes a este stack (TS/Node + Agents SDK + Supabase + Graph): naming de código/DB, organização de arquivos, formato de datas/timezone no Graph, env vars, formato das mensagens de WhatsApp, contrato das function tools, e tratamento de erro/log.

### Naming Patterns

**Database (Postgres/Supabase):**
- Tabelas em `snake_case` plural: `conversations`, `messages`, `appointments`.
- Colunas em `snake_case`: `conversation_id`, `created_at`, `graph_event_id`, `join_url`.
- PK = `id` (uuid, default `gen_random_uuid()`). FK = `<entidade_singular>_id` (`conversation_id`).
- Timestamps sempre `timestamptz`, nomeados `created_at` / `updated_at`.
- Enums como `text` + CHECK (POC), ex.: `status`, `demand_type`, `meeting_format`.

**Código (TypeScript):**
- Arquivos em `kebab-case`: `graph-client.ts`, `availability-tool.ts`, `conversation-repo.ts`.
- Variáveis/funções em `camelCase`: `getAvailability`, `lucasUserId`.
- Tipos/interfaces/classes em `PascalCase`: `Conversation`, `SlotOffer`, `BriefingInput`.
- Constantes de config/env em `UPPER_SNAKE_CASE`.
- Mapeamento DB↔código: a camada de repositório converte `snake_case` (DB) ↔ `camelCase` (app). Resto do código nunca vê `snake_case`.

**Function tools do agente:** nome em `camelCase` verbo+objeto: `getAvailability`, `createAppointment`, `escalateToLucas`. Schemas de input/output em zod, um arquivo por tool.

### Structure Patterns

```
src/
  server.ts              # bootstrap Express + rota POST /webhook
  config.ts              # leitura/validação de env (zod) — única fonte de config
  agent/
    pre-atendimento.ts   # definição do agente + instruções
    guardrails.ts        # guardrail jurídico
    tools/
      get-availability.ts
      create-appointment.ts
      escalate-to-lucas.ts
  integrations/
    graph-client.ts      # auth app-only + chamadas Calendar
    evolution-client.ts  # envio de mensagens WhatsApp
    supabase-client.ts    # client + repositórios
  domain/
    slots.ts             # geração de slots (seg-sex 9-18h, 1h, máx 3)
    briefing.ts          # montagem do Briefing (FR-8)
  repos/
    conversation-repo.ts
    appointment-repo.ts
  types.ts
```
- Sem transpile na POC: `tsx watch src/server.ts` em dev; em prod, container Node executando `tsx` (sem build step), gerenciado pelo Easypanel.
- Lógica de negócio (slots, briefing) fica em `domain/` — não dentro das tools (tools só orquestram).

### Format Patterns

**Datas/Timezone (crítico p/ Graph e slots):**
- Toda lógica de horário em **America/Sao_Paulo**.
- Chamadas Graph usam objeto `{ dateTime, timeZone: "E. South America Standard Time" }` (nome de timezone do Windows que o Graph espera) + header `Prefer: outlook.timezone="E. South America Standard Time"`.
- Internamente, datas trafegam como ISO 8601 com offset; nunca strings ambíguas sem timezone.

**Dados/JSON:** `camelCase` em todo objeto de aplicação e payload de tool. Booleanos `true/false`. Campos ausentes = `null` explícito, não `undefined` em persistência.

**Mensagens WhatsApp (saída):** texto puro, tom cordial e simples (PRD), sem markdown pesado; listas de slots numeradas (`1)`, `2)`, `3)`); identifica-se como assistente do "Escritório do Lucas".

### Communication Patterns

**Webhook → agente:** evento da Evolution normalizado para um tipo interno `InboundMessage { phone, text, timestamp }` antes de tocar a lógica. Nenhum outro módulo lê o payload bruto da Evolution.
**Resposta:** sempre via `evolutionClient.sendText(phone, text)`. Fallback usa o mesmo client com `LUCAS_WHATSAPP` do config.
**Estado:** atualizações de conversa sempre via `conversation-repo` (nunca SQL solto espalhado). Uma escrita por turno, com `updated_at` renovado.

### Process Patterns

**Erros:**
- Toda chamada externa (Graph/OpenAI/Evolution) embrulhada em try/catch no nível da tool/integração.
- Falha de integração → a tool retorna um resultado de erro estruturado (`{ ok: false, reason }`), o agente responde com cortesia ao cliente e, se for bloqueante p/ agendar, aciona `escalateToLucas`.
- Erros nunca vazam stack/termos técnicos ao cliente final.

**Logging:** `console` estruturado com prefixo de contexto `[webhook]`, `[agent]`, `[graph]`, `[evolution]` + o `phone` mascarado. Tracing do Agents SDK habilitado p/ depurar a demo. Sem PII sensível em log além do necessário.

**Idempotência/consistência:** `createAppointment` re-checa disponibilidade via `getSchedule` imediatamente antes de criar o evento; se o slot caiu, retorna erro e o agente reoferta (FR-6).

### Enforcement Guidelines

**Todo agente de IA / contribuição DEVE:**
- Acessar config só via `config.ts` (env validado por zod); nunca `process.env` espalhado.
- Acessar dados só via repositórios; nunca SQL/Supabase client direto fora de `repos/` e `integrations/supabase-client.ts`.
- Pôr lógica de negócio em `domain/`, não nas tools nem no webhook.
- Usar America/Sao_Paulo + o nome de timezone Windows nas chamadas Graph.
- Nunca emitir conteúdo jurídico (guardrail) e sempre se identificar como assistente.

**Anti-patterns (evitar):**
- `process.env.X` direto no meio do código.
- Datas sem timezone / uso de horário do servidor (UTC) p/ gerar slots.
- Montar texto de WhatsApp com markdown de tabela/código.
- Tool que fala direto com o banco pulando o repositório.

## Project Structure & Boundaries

### Complete Project Directory Structure

```
poc-ia-atendimento/
├── README.md
├── package.json
├── tsconfig.json
├── .env                       # segredos reais (NÃO versionar)
├── .env.example               # template das variáveis
├── .gitignore
├── Dockerfile                 # imagem Node 24 (deploy via Easypanel)
├── supabase/
│   └── migrations/
│       └── 0001_init.sql       # conversations, messages, appointments
└── src/
    ├── server.ts               # bootstrap Express + POST /webhook + GET /health
    ├── config.ts               # env validado por zod (única fonte de config)
    ├── types.ts                # tipos compartilhados (Conversation, SlotOffer, InboundMessage…)
    ├── webhook/
    │   ├── handler.ts          # valida segredo, normaliza evento → InboundMessage, enfileira
    │   └── queue.ts            # serialização por telefone (lock/fila em memória)
    ├── agent/
    │   ├── pre-atendimento.ts  # definição do agente + instruções (ordem dos FRs)
    │   ├── runner.ts           # carrega estado → roda agente → persiste → responde
    │   ├── guardrails.ts       # guardrail jurídico (saída)
    │   └── tools/
    │       ├── get-availability.ts
    │       ├── create-appointment.ts
    │       └── escalate-to-lucas.ts
    ├── domain/
    │   ├── slots.ts            # geração de slots (seg-sex 9–18h, 1h, máx 3, prioriza preferência)
    │   ├── briefing.ts         # montagem do Briefing (FR-8)
    │   ├── triage.ts           # tipos de demanda + regras de fora-de-escopo
    │   └── datetime.ts         # helpers America/Sao_Paulo ↔ formato Graph
    ├── integrations/
    │   ├── graph-client.ts     # auth app-only (ClientSecretCredential) + getSchedule/createEvent
    │   ├── evolution-client.ts # sendText (resposta + fallback)
    │   └── supabase-client.ts  # client (service role)
    └── repos/
        ├── conversation-repo.ts
        ├── message-repo.ts
        └── appointment-repo.ts
```

(Testes automatizados não são meta da POC — ver Não-Metas do PRD. Validação é via demo ponta a ponta. Se desejado, `*.test.ts` co-locados + Vitest seriam o padrão.)

### Architectural Boundaries

**API Boundaries (externas):**
- `POST /webhook` — única entrada; recebe eventos da Evolution API (mensagem recebida). Protegido por segredo compartilhado.
- `GET /health` — healthcheck p/ a VPS/proxy.
- Saídas: Microsoft Graph (`/users/{lucasId}/calendar/...`), Evolution API (envio de mensagens), OpenAI (via Agents SDK).

**Component Boundaries (internas):**
- `webhook/` só conhece HTTP + normalização; não conhece agente nem banco diretamente (chama `agent/runner`).
- `agent/` orquestra; tools chamam `domain/` + `integrations/` + `repos/`. Tools não contêm regra de negócio.
- `domain/` é puro (sem I/O): slots, briefing, triagem, datetime. Testável isoladamente.
- `integrations/` é o único lugar que fala com serviços externos.
- `repos/` é o único lugar que fala com o banco.

**Data Boundaries:**
- Acesso a dados exclusivamente via `repos/*`. Conversão `snake_case`(DB) ↔ `camelCase`(app) acontece aqui.
- Schema versionado em `supabase/migrations/`.

### Requirements to Structure Mapping

| Feature / FR | Onde vive |
|---|---|
| FR-1 Saudação · FR-2 Triagem | `agent/pre-atendimento.ts` (instruções) + `domain/triage.ts` |
| FR-3 Coleta de dados | `agent/pre-atendimento.ts` + `repos/conversation-repo.ts` (`collected` jsonb) + validação zod |
| FR-4 Formato online/presencial | `agent/pre-atendimento.ts` + `agent/tools/create-appointment.ts` |
| FR-5 Disponibilidade + Slots | `agent/tools/get-availability.ts` + `domain/slots.ts` + `integrations/graph-client.ts` (getSchedule) |
| FR-6 Confirmação | `agent/pre-atendimento.ts` + re-checagem em `create-appointment.ts` |
| FR-7 Convite + trava | `agent/tools/create-appointment.ts` + `graph-client.ts` (createEvent) + `repos/appointment-repo.ts` |
| FR-8 Briefing | `domain/briefing.ts` (usado por `create-appointment.ts`) |
| FR-9 Fallback ao Lucas | `agent/tools/escalate-to-lucas.ts` + `evolution-client.ts` |

**Cross-Cutting Concerns:**
- Guardrail jurídico → `agent/guardrails.ts` (aplica a todos os turnos).
- Config/segredos → `config.ts`.
- Timezone → `domain/datetime.ts`.
- Estado da conversa → `repos/conversation-repo.ts` + `message-repo.ts`.

### Integration Points

**Internal Communication (fluxo de um turno):**
`server.ts` → `webhook/handler.ts` (valida + normaliza) → `webhook/queue.ts` (serializa por telefone) → `agent/runner.ts` (carrega estado via repos → roda agente → tools) → persiste → `evolution-client.sendText()`.

**External Integrations:**
- Evolution API: entrada (webhook) e saída (envio). Auth por `apikey`.
- Microsoft Graph: getSchedule (free/busy) + createEvent (com Teams `joinUrl` + attendees → convites por e-mail). Auth app-only `Calendars.ReadWrite`.
- OpenAI: inferência via Agents SDK.
- Supabase: persistência (service role key).

**Data Flow:**
WhatsApp → Evolution → `/webhook` → fila por telefone → agente (lê `conversations`/`messages`) → tools (Graph/Evolution) → grava `appointments` + estado → resposta ao cliente; em fora-de-escopo, notifica o Lucas.

### File Organization Patterns

**Config:** `.env` (real) + `.env.example` (template) na raiz; lidos só por `config.ts`.
**Source:** por responsabilidade/camada (webhook → agent → domain → integrations → repos), conforme padrões da seção anterior.
**Test:** não na POC (demo valida); padrão futuro = `*.test.ts` co-locado + Vitest.
**Assets:** não se aplica (sem UI).

### Development Workflow Integration

**Dev:** `npm run dev` → `tsx watch src/server.ts`; webhook exposto pela URL pública da VPS (mesma da Evolution) ou subdomínio.
**Build:** sem transpile na POC (tsx executa TS direto).
**Deploy:** app no Easypanel (mesma VPS Hostinger da Evolution) a partir do repo GitHub; o Easypanel faz build do `Dockerfile`, roteia o subdomínio → `/webhook` e provê SSL automaticamente. Migrations aplicadas via Supabase CLI/MCP.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** Stack coeso e compatível — TS/Node 24 LTS + `@openai/agents` + Express + `@supabase/supabase-js` + `@azure/identity`/`@microsoft/microsoft-graph-client`. Todas as libs são Node-nativas e convivem sem conflito. Auth app-only do Graph e service-role do Supabase combinam com um serviço server-only sem usuário logado.

**Pattern Consistency:** Padrões (naming snake_case no DB ↔ camelCase no app, datas sempre com timezone Windows do Graph, config só via `config.ts`, dados só via `repos/`) sustentam as decisões e não se contradizem.

**Structure Alignment:** A árvore (`webhook → agent → domain → integrations → repos`) realiza as fronteiras definidas; cada FR tem lar explícito.

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**
- FR-1/2/3 (saudação, triagem, coleta) → `agent/pre-atendimento.ts` + `domain/triage.ts` + `conversation-repo`. ✅
- FR-4 (formato) → instruções + `create-appointment`. ✅
- FR-5 (disponibilidade/slots) → `get-availability` + `domain/slots.ts` + Graph `getSchedule`. ✅
- FR-6 (confirmação) → instruções + re-checagem no `create-appointment`. ✅
- FR-7 (convite+trava+e-mail+Teams) → `create-appointment` + Graph `createEvent` (`isOnlineMeeting`/`teamsForBusiness`, attendees → convites). ✅
- FR-8 (briefing) → `domain/briefing.ts`. ✅
- FR-9 (fallback WhatsApp) → `escalate-to-lucas` + `evolution-client`. ✅

**Non-Functional Requirements Coverage:**
- Guardrail jurídico → `agent/guardrails.ts` (transversal). ✅
- Consistência de agenda (sem dupla marcação) → fonte da verdade = calendário + re-checagem. ✅
- 24/7 responde / agendamento seg-sex 9–18h → `domain/slots.ts`. ✅
- Latência "poucos segundos" → ack 200 imediato + processamento assíncrono. ✅ (razoável p/ demo)
- LGPD/custo/demo → tratados como POC (controlado, baixo volume). ✅

### Implementation Readiness Validation ✅

**Decision Completeness:** Decisões críticas documentadas (conta M365, auth `Calendars.ReadWrite`, dados, webhook). Versões verificadas (Node 24 LTS; Agents SDK TS; permissões Graph confirmadas na doc oficial).
**Structure Completeness:** Árvore completa e específica, com fronteiras e mapeamento FR→arquivo.
**Pattern Completeness:** Naming, estrutura, formato (datas/JSON/WhatsApp), comunicação e processo (erros/log/idempotência) cobertos com exemplos.

### Gap Analysis Results

**Critical Gaps:** Nenhum.

**Important Gaps (verificar na implementação, não bloqueiam o design):**
1. **Teams via evento app-only:** a doc exemplifica criação de evento online em fluxo *delegated* (`/me`). Criar `event` com `isOnlineMeeting` em app-only sobre `/users/{id}/events` deve funcionar com `Calendars.ReadWrite` (calendário Teams-enabled), mas **validar no primeiro teste**; fallback = fluxo delegated com refresh token, se necessário.
2. **"Lucas" no tenant de POC:** na demo, o calendário/usuário será um usuário do tenant M365 Developer do Felyppe (não a conta real do Lucas). Convites e briefing chegam a usuários de teste — combinar com a narrativa da demo.

**Nice-to-Have Gaps:**
- Nome exato do modelo OpenAI (confirmar via MCP no momento de codar).
- Debounce de mensagens curtas consecutivas do WhatsApp.
- Tratamento de áudio/mídia recebida (POC assume texto; se cliente mandar áudio, transcrever via OpenAI seria um incremento).

### Validation Issues Addressed

Os gaps importantes foram registrados com mitigação clara (fallback delegated p/ Teams; usuários de teste no tenant). Nenhum exige mudança estrutural agora.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY WITH MINOR GAPS (16/16 itens marcados; sem Critical Gaps. "Minor gaps" referem-se a itens de verificação na implementação — Teams app-only e usuários de teste no tenant —, não a lacunas de design.)

**Confidence Level:** high — decisões-chave ancoradas em doc oficial verificada (Graph) e versões atuais (Node/Agents SDK).

**Key Strengths:**
- Auth simplificada a uma única permissão (`Calendars.ReadWrite`) cobrindo free/busy + Teams + evento.
- Fronteiras limpas (domain puro, I/O isolado) tornam o agente testável e o código consistente.
- Consistência de agenda garantida pela re-checagem (mata o risco nº1 da demo: dupla marcação).

**Areas for Future Enhancement:**
- Migrar de app-only no tenant de POC p/ a conta/tenant real do Lucas na produção.
- Observabilidade, retries e tratamento de mídia/áudio.
- Lembretes/reagendamento (fora do MVP).

### Implementation Handoff

**AI Agent Guidelines:**
- Seguir as decisões de arquitetura exatamente como documentadas.
- Aplicar os padrões de implementação de forma consistente.
- Respeitar a estrutura e as fronteiras (domain puro; I/O só em integrations; dados só em repos).
- Consultar este documento para qualquer dúvida arquitetural; consultar os MCPs (Microsoft/OpenAI/Supabase) antes de cravar endpoints/assinaturas.

**First Implementation Priority:**
Provisionar tenant M365 Developer + app registration (Entra ID, `Calendars.ReadWrite`, admin consent) e, em paralelo, rodar o scaffold:
```bash
mkdir poc-ia-atendimento && cd poc-ia-atendimento && npm init -y && npm pkg set type=module
npm install @openai/agents openai zod express @supabase/supabase-js dotenv @azure/identity @microsoft/microsoft-graph-client
npm install -D typescript tsx @types/node @types/express
npx tsc --init
```
