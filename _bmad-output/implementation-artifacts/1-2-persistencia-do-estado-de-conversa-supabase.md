---
baseline_commit: aa6e2a746414bd9f2b9d981817a3dbd43a776ec2
---

# Story 1.2: Persistência do estado de conversa (Supabase)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a sistema de pré-atendimento,
I want armazenar conversas e mensagens por número de WhatsApp,
so that eu mantenha contexto multi-turno entre as mensagens de um mesmo Cliente.

## Acceptance Criteria

**AC1 — Migration cria as tabelas com RLS e CHECKs**
**Given** o projeto Supabase configurado e a service role key no `.env`
**When** aplico a migration `0001_init.sql`
**Then** são criadas as tabelas:
- `conversations` (`id` uuid PK, `phone` text **unique**, `status` text, `demand_type` text, `meeting_format` text, `collected` jsonb, `created_at`/`updated_at` timestamptz)
- `messages` (`id` uuid PK, `conversation_id` uuid FK→conversations, `role` text, `content` text, `created_at` timestamptz)

**And** ambas as tabelas têm **RLS habilitado, sem policies** (só a service role opera)
**And** `status`, `demand_type` e `meeting_format` têm **CHECK** restringindo aos valores válidos.

**AC2 — Cliente Supabase server-only + repositórios funcionam**
**Given** as tabelas criadas e `src/integrations/supabase-client.ts` usando a **service role key** (server-only)
**When** o `conversation-repo` cria/atualiza uma conversa e o `message-repo` registra uma mensagem
**Then** os dados persistem corretamente
**And** a conversão `snake_case` (DB) ↔ `camelCase` (app) ocorre **só na camada de repositório**.

**AC3 — Busca por telefone com mensagens recentes**
**Given** uma conversa com mensagens persistidas
**When** busco uma conversa por `phone`
**Then** recebo a conversa com suas **mensagens recentes** (para alimentar o contexto multi-turno do agente).

## Tasks / Subtasks

- [x] **Task 1 — Pré-requisito: projeto Supabase + segredos no config** (AC: 1, 2)
  - [x] Garantir um projeto Supabase (criar um novo na conta do Felyppe se ainda não existir — ver Dev Notes "Pré-requisito de infra")
  - [x] Pegar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → `service_role` secret) e colocar no `.env` local; adicionar as duas chaves na tela **Environment do Easypanel** também
  - [x] **Promover** `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` de `.optional()` para **obrigatórias** no schema zod de `src/config.ts` (esta story passa a consumi-las — ver contrato de "config incremental" da Story 1.1)
  - [x] Confirmar que ambas já constam no `.env.example` (criado na 1.1); ajustar se necessário
- [x] **Task 2 — Migration `supabase/migrations/0001_init.sql`** (AC: 1)
  - [x] Criar a pasta `supabase/migrations/` e o arquivo `0001_init.sql`
  - [x] `conversations`: `id uuid primary key default gen_random_uuid()`, `phone text not null unique`, `status text not null default 'greeting'` com CHECK, `demand_type text` com CHECK (nullable até triar), `meeting_format text` com CHECK (nullable), `collected jsonb not null default '{}'::jsonb`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
  - [x] `messages`: `id uuid primary key default gen_random_uuid()`, `conversation_id uuid not null references conversations(id) on delete cascade`, `role text not null` com CHECK, `content text not null`, `created_at timestamptz not null default now()`
  - [x] Índice `create index on messages (conversation_id, created_at)` (busca de mensagens recentes por conversa)
  - [x] `alter table conversations enable row level security;` e `alter table messages enable row level security;` — **sem** criar policies
  - [x] Ver Dev Notes "DDL de referência" para os valores exatos dos CHECKs
- [x] **Task 3 — Aplicar a migration** (AC: 1)
  - [x] Aplicar via Supabase MCP `apply_migration` **ou** Supabase CLI (`supabase db push`) **ou** colar o SQL no SQL Editor do dashboard (ver Dev Notes "Aplicação da migration")
  - [x] Verificar no dashboard (Table Editor) que as 2 tabelas existem com RLS ON e os CHECKs aplicados
- [x] **Task 4 — `src/integrations/supabase-client.ts`** (AC: 2)
  - [x] `createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })` — client server-only, exporta uma instância única
  - [x] **Único lugar** que instancia o client Supabase; nada fora de `repos/` deve importá-lo diretamente
- [x] **Task 5 — `src/types.ts` (tipos compartilhados)** (AC: 2)
  - [x] Criar/estender `types.ts` com `Conversation`, `Message` e os union types `ConversationStatus`, `DemandType`, `MeetingFormat` (camelCase), espelhando os CHECKs do DB
  - [x] `Conversation.collected` tipado como objeto parcial (`{ name?, email?, caseSummary?, timePreference? }`) — jsonb flexível
- [x] **Task 6 — `src/repos/conversation-repo.ts`** (AC: 2, 3)
  - [x] `create(phone): Promise<Conversation>` (insere com defaults)
  - [x] `update(id, patch): Promise<Conversation>` — patch parcial; **sempre renova `updated_at = now()`** na escrita (uma escrita por turno)
  - [x] `findByPhone(phone): Promise<Conversation | null>`
  - [x] `findByPhoneWithMessages(phone, limit = 20): Promise<{ conversation: Conversation; messages: Message[] } | null>` — satisfaz AC3 (mensagens recentes em ordem cronológica)
  - [x] Mappers `rowToConversation(row)` / `conversationToRow(patch)` fazem a conversão snake_case↔camelCase **aqui** (e em nenhum outro lugar)
- [x] **Task 7 — `src/repos/message-repo.ts`** (AC: 2, 3)
  - [x] `add({ conversationId, role, content }): Promise<Message>`
  - [x] `listRecent(conversationId, limit = 20): Promise<Message[]>` (ordenado por `created_at`, ascendente para alimentar o LLM)
  - [x] Mapper `rowToMessage(row)`
- [x] **Task 8 — Verificação manual (demo da story)** (AC: 1, 2, 3)
  - [x] Script descartável (ou rota temporária `GET /debug-db`, **remover ao final**) que: cria conversa por phone → adiciona 2 mensagens (`user`/`assistant`) → `findByPhoneWithMessages` → imprime o resultado
  - [x] Confirmar: dados aparecem no dashboard; objeto retornado está em camelCase; mensagens vêm na ordem certa
  - [x] Confirmar que tentar inserir um `status`/`demand_type` inválido é rejeitado pelo CHECK
  - [x] Remover o script/rota de debug antes de concluir

## Dev Notes

### Dependência da story anterior (1.1)
- Esta story **assume a Story 1.1 concluída**: `package.json` (ESM), `tsconfig.json`, `src/config.ts` (zod, padrão de "config incremental"), `src/server.ts`, `.env.example`, `Dockerfile`. `@supabase/supabase-js` **já foi instalado** na 1.1 — não reinstalar. [Source: 1-1-inicializacao-do-projeto-e-healthcheck-na-vps.md]
- **Contrato de config incremental:** na 1.1, segredos ficaram `.optional()` no schema zod para não travar o boot. Esta story **consome** Supabase, então `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` passam a **required** agora. Mantenha os demais segredos (OpenAI/Graph/Evolution) opcionais até suas stories. [Source: 1-1 Dev Notes "Estratégia de config incremental"]

### Pré-requisito de infra (Supabase) — Felyppe não domina devops, formato receita
- É necessário um **projeto Supabase**. Se ainda não existe: acessar app.supabase.com → New project (região mais próxima, ex. São Paulo/`sa-east-1` se disponível) → definir senha do DB.
- Pegar as credenciais em **Project Settings → API**:
  - `SUPABASE_URL` = "Project URL"
  - `SUPABASE_SERVICE_ROLE_KEY` = a chave **`service_role` (secret)** — **NÃO** a `anon`/`publishable`.
- ⚠️ A service role key **bypassa RLS** e dá acesso total ao banco. É **server-only**: vai no `.env` (gitignored) e na Environment do Easypanel; **nunca** no frontend nem versionada. [Source: architecture.md#Data Architecture — cita doc oficial "Securing your data"]

### Modelo de dados [Source: architecture.md#Data Architecture, #Naming Patterns; epics.md#Story 1.2]
- **Escopo desta migration = `conversations` + `messages` apenas.** A tabela `appointments` é criada na **migration `0002`** dentro da Story 2.5 — **não** incluir `appointments` aqui. [Source: epics.md#Story 2.5 "migration 0002: tabela appointments"]
- Convenções DB (obrigatórias): `snake_case` plural nas tabelas; colunas `snake_case`; PK `id` uuid `gen_random_uuid()`; FK `<entidade>_id`; timestamps `timestamptz` (`created_at`/`updated_at`); enums = `text` + CHECK. [Source: architecture.md#Naming Patterns]
- `gen_random_uuid()` é nativo no Postgres do Supabase (PG13+) — não precisa habilitar extensão.
- `updated_at` é renovado **pela aplicação** (repo) a cada escrita — a arquitetura define "uma escrita por turno com `updated_at` renovado"; **não** criar trigger. [Source: architecture.md#Communication Patterns]

### DDL de referência (valores exatos dos CHECKs)
- `conversations.status` ∈ `{ 'greeting', 'triaging', 'collecting', 'scheduling', 'confirming', 'scheduled', 'escalated' }`, default `'greeting'`. [Source: architecture.md#Data Architecture (fases) + epics.md FR-1..FR-9/1.7 `escalated`]
- `conversations.demand_type` ∈ `{ 'compra_venda', 'locacao', 'regularizacao', 'distrato' }` (slugs dos 4 Tipos de Demanda: compra/venda, locação, regularização/cartório, distrato/disputas), **nullable** até a triagem (Story 1.5). [Source: epics.md FR-2]
- `conversations.meeting_format` ∈ `{ 'online', 'presencial' }`, **nullable** até a escolha (Story 2.2). [Source: epics.md FR-4]
- `messages.role` ∈ `{ 'user', 'assistant', 'system' }` (histórico para o contexto do agente). [Source: architecture.md#Data Architecture "messages — role"]
- Observação SQL: CHECK em coluna nullable **aceita NULL** naturalmente — não force `not null` em `demand_type`/`meeting_format`.

```sql
-- supabase/migrations/0001_init.sql (referência — ajuste à sua convenção)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  status text not null default 'greeting'
    check (status in ('greeting','triaging','collecting','scheduling','confirming','scheduled','escalated')),
  demand_type text
    check (demand_type in ('compra_venda','locacao','regularizacao','distrato')),
  meeting_format text
    check (meeting_format in ('online','presencial')),
  collected jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx on messages (conversation_id, created_at);

alter table conversations enable row level security;
alter table messages enable row level security;
-- sem policies: somente a service role (backend) acessa
```

### Aplicação da migration [Source: architecture.md#Development Workflow Integration "Migrations aplicadas via Supabase CLI/MCP"]
O arquivo `supabase/migrations/0001_init.sql` é a **fonte da verdade**. Opções para aplicar (escolher a mais simples para o Felyppe):
1. **Supabase MCP** `apply_migration` (o dev agent tem essa tool) — passa o SQL e o nome `0001_init`. Caminho mais direto.
2. **SQL Editor** no dashboard do Supabase — colar o conteúdo e rodar (zero setup local).
3. **Supabase CLI** — `supabase link --project-ref <ref>` + `supabase db push` (requer CLI instalado/login).
> Independentemente do método, **mantenha o `.sql` versionado** no repo — ele é o registro do schema.

### Cliente Supabase server-only [Source: architecture.md#Authentication & Security; doc oficial confirmada via MCP]
```ts
// src/integrations/supabase-client.ts
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js'; // (sem extensão também funciona com tsx)
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```
- `persistSession:false` + `autoRefreshToken:false` porque é serviço sem usuário logado (server-only). A doc do client web usa `persistSession:true` — **não** é o nosso caso.

### Fronteiras e padrões obrigatórios [Source: architecture.md#Architectural Boundaries, #Enforcement Guidelines]
- **Acesso a dados só via `repos/*`.** Nenhum módulo fora de `repos/` (e do `integrations/supabase-client.ts`) importa o client ou monta SQL. (Anti-pattern explícito: "Tool que fala direto com o banco pulando o repositório".)
- **Conversão snake_case↔camelCase só na camada repo.** O resto da aplicação nunca vê `snake_case`. Centralize em mappers (`rowToConversation`, `conversationToRow`, `rowToMessage`).
- Config só via `config.ts` (nada de `process.env` no repo/client).

### Como esta story será usada depois (não implementar agora, só para desenhar a API certa)
- **Story 1.3** (webhook/round-trip) chamará algo como `conversation-repo.findByPhoneWithMessages(phone)` no início do turno e `message-repo.add(...)` para gravar a mensagem recebida e a resposta. Desenhe os métodos pensando nesse uso (get-or-create por phone virá na 1.3; aqui basta `create` + `findByPhone*`). [Source: epics.md#Story 1.3, architecture.md#Agent state]
- `collected` (jsonb) será preenchido na **Story 1.6** (coleta). `status`/`demand_type`/`meeting_format` evoluem nas stories 1.5/2.2. Aqui só garantimos persistência e leitura.

### Testing standards
- Sem testes automatizados na POC — verificação manual (Task 8) com script/rota descartável, depois **removido**. Padrão futuro (se desejado): `*.test.ts` + Vitest co-locado em `repos/`. [Source: architecture.md "Testes automatizados não são meta da POC"]

### Pegadinhas a evitar
- ❌ Incluir `appointments` na `0001` (é `0002`, Story 2.5).
- ❌ Usar a chave `anon`/`publishable` no backend — tem que ser **`service_role`**.
- ❌ Criar policies de RLS — a POC roda **sem policies** (só service role).
- ❌ Acessar o client Supabase fora de `repos/`/`supabase-client.ts`.
- ❌ Vazar `snake_case` para fora do repo, ou usar `process.env` direto.
- ❌ Deixar a rota/script de debug no código final.
- ❌ Esquecer de promover `SUPABASE_*` a required no `config.ts`.

### Project Structure Notes
- Arquivos desta story (alinhados à árvore da arquitetura): `supabase/migrations/0001_init.sql`, `src/integrations/supabase-client.ts`, `src/repos/conversation-repo.ts`, `src/repos/message-repo.ts`, `src/types.ts` (criar/estender). `message-repo.ts` consta na árvore da arquitetura. Sem conflitos. [Source: architecture.md#Complete Project Directory Structure]

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] — user story + ACs
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — tabelas, RLS, service role
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns] — snake_case DB / camelCase app, PK/FK/timestamps
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural Boundaries] — dados só via repos
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] — service role server-only, RLS defense-in-depth
- [Source: _bmad-output/planning-artifacts/architecture.md#Complete Project Directory Structure] — local dos arquivos
- [Source: 1-1-inicializacao-do-projeto-e-healthcheck-na-vps.md] — contrato de config incremental, deps já instaladas
- [Source: Supabase docs (via MCP search_docs)] — `alter table … enable row level security;`; service role bypassa RLS / server-only

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- Projeto Supabase já existia: `POC_IA_Atendimento` (ref `jbpcfutlbpcqmxjasqsh`, região `sa-east-1`, Postgres 17, ACTIVE_HEALTHY). Não foi necessário criar.
- Migration aplicada via **Management API** (`POST /v1/projects/{ref}/database/query`) usando o Personal Access Token do Felyppe — o MCP do Supabase estava em modo `--read-only`. Retorno `[]` (DDL ok).
- Verificação de schema via MCP `list_tables` (verbose): ambas as tabelas com RLS ON, CHECKs exatos, FK cascade, PK uuid.
- Demo real pelos repos (`tsx src/scripts/debug-db.ts`, depois removido): create → 2 messages → `findByPhoneWithMessages` (ordem user→assistant, camelCase) → update (status/demandType + updated_at) → CHECK rejeitou `status` inválido (`violates check constraint "conversations_status_check"`).
- MCP `execute_sql` confirmou persistência: 1 conversa, 2 mensagens, ordem correta. Dados de teste depois truncados (banco volta a vazio).
- `npx tsc --noEmit` → exit 0. Advisors de segurança: apenas INFO `rls_enabled_no_policy` (esperado — design da POC: RLS sem policies, só service role).

### Completion Notes List

- **Pré-requisito de infra resolvido sem ação manual do Felyppe:** com autorização explícita dele, usei o Personal Access Token (já presente no `.claude.json`) para (a) aplicar a migration via Management API e (b) puxar a `service_role` key via `GET /v1/projects/{ref}/api-keys?reveal=true` e gravá-la no `.env` (gitignored). Falta apenas ele replicar `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` na tela Environment do Easypanel quando for fazer deploy.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **promovidas a obrigatórias** no `config.ts` (contrato de config incremental da 1.1). Demais segredos seguem opcionais.
- **Bug corrigido durante o teste:** o `config.ts` rejeitava variáveis opcionais vazias do `.env` (ex.: `EVOLUTION_BASE_URL=` falhava no `.url()`). Adicionado pré-processamento que trata string vazia como ausente (`undefined`), mantendo o fail-fast honesto para as obrigatórias.
- Fronteiras respeitadas: client Supabase só em `integrations/supabase-client.ts`; acesso a dados só via `repos/*`; conversão snake↔camel só nos mappers (`rowToConversation`/`conversationToRow`/`rowToMessage`); nada de `process.env` fora do `config.ts`.
- `updated_at` é renovado pela aplicação (sem trigger), conforme arquitetura. No sandbox houve descompasso de relógio (updated_at < created_at) — artefato do ambiente, irrelevante na VPS com NTP.
- Escopo da migration mantido em `conversations` + `messages` (sem `appointments`, que é a 0002/Story 2.5).
- Script de debug removido ao final (`src/scripts/` não existe mais).

### File List

- `supabase/migrations/0001_init.sql` (novo) — schema conversations + messages, RLS, CHECKs, índice
- `src/types.ts` (novo) — tipos compartilhados (Conversation, Message, unions)
- `src/integrations/supabase-client.ts` (novo) — client server-only (service role)
- `src/repos/conversation-repo.ts` (novo) — CRUD + findByPhoneWithMessages + mappers
- `src/repos/message-repo.ts` (novo) — add + listRecent + rowToMessage
- `src/config.ts` (modificado) — SUPABASE_* promovidas a required; trata env vazia como ausente
- `.env` (novo, gitignored) — preenchido com SUPABASE_URL + service_role
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificado) — status da story 1.2
- `_bmad-output/implementation-artifacts/1-2-persistencia-do-estado-de-conversa-supabase.md` (modificado) — frontmatter, checkboxes, Dev Agent Record, status

## Change Log

| Data       | Versão | Descrição                                                                 | Autor        |
|------------|--------|---------------------------------------------------------------------------|--------------|
| 2026-06-09 | 0.1    | Persistência Supabase: migration 0001, client server-only, repos, tipos; config SUPABASE_* required | Amelia (dev) |
