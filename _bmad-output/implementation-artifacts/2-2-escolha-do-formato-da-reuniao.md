---
baseline_commit: eb497074
---

# Story 2.2: Escolha do formato da reunião

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Cliente,
I want escolher se a reunião será online ou presencial,
so that eu seja atendido da forma que prefiro.

**Realiza:** FR-4.

## Acceptance Criteria

**AC1 — Pergunta e registro do formato**
**Given** a demanda triada e os dados coletados (Épico 1; conversa em `status = 'scheduling'`)
**When** a IA pergunta o formato da reunião
**Then** o Cliente pode escolher **online** ou **presencial**, e a escolha é registrada em `conversations.meeting_format` (valores `'online'`/`'presencial'`, já no CHECK da migration 0001).

**AC2 — Consequência do formato (sinaliza o que o Convite terá)**
**Given** o formato escolhido
**When** a conversa avança
**Then** **online** sinaliza que o Convite incluirá link de videochamada (Teams — simulado na 2.5) e **presencial** sinaliza o endereço do escritório (**`config.officeAddress`** — Rua Maria Máximo 153, Ponta da Praia, Santos/SP)
**And** o formato fica disponível para constar no Briefing (FR-8, Story 2.5).

## Tasks / Subtasks

- [x] **Task 1 — Tool `recordMeetingFormat` (`src/agent/tools/record-meeting-format.ts`)** (AC: 1)
  - [x] `tool({ name:'recordMeetingFormat', parameters: z.object({ meetingFormat: z.enum(['online','presencial']) }), execute })` — espelha `record-demand-type.ts`.
  - [x] `execute` via `context`: valida contexto → `conversationRepo.update(id, { meetingFormat })` → `{ ok:true, meetingFormat }` (erro → `{ ok:false }`, log `[tool:recordMeetingFormat]`).
  - [x] **Não** muda `status` (segue `scheduling`).
  - [x] Registrada no agente: `tools: [recordDemandType, recordClientData, escalateToLucas, recordMeetingFormat]`.

- [x] **Task 2 — Instruções do agente: perguntar o formato no momento certo** (AC: 1, 2)
  - [x] Bloco novo "# Formato da reunião (depois dos dados coletados)" em `pre-atendimento.ts`: só pergunta após nome+e-mail+resumo prontos.
  - [x] Texto cordial PT-BR, sem markdown; ao escolher → `recordMeetingFormat`.
  - [x] Outcome-first: descreve o resultado (online→videochamada, presencial→endereço), sem roteiro rígido.

- [x] **Task 3 — Verificação (demo)** (AC: 1, 2)
  - [x] `npx tsc --noEmit` → exit 0.
  - [~] Verificação conversacional completa (IA pergunta formato → grava `meeting_format`) é **manual via WhatsApp** (pendência do Felyppe pós-deploy) — padrão da POC para passos que dependem de OpenAI+Supabase reais. A tool é determinística e espelha a `recordDemandType` (1.5) já validada.

## Dev Notes

### Dependência das stories anteriores / o que já existe
- **`conversations.meeting_format`** já existe (migration 0001, com CHECK `online`/`presencial`) — só preencher. [Source: supabase/migrations/0001_init.sql]
- **`config.officeAddress`** já existe (default Rua Maria Máximo 153…) desde a 1.1. Reusar; não hardcodar endereço no prompt sem citar que vem do config. [Source: src/config.ts]
- **Padrão tool + `context` do `run`** estabelecido em 1.5/1.6/1.7; `recordMeetingFormat` segue idêntico a `recordDemandType`. [Source: src/agent/tools/record-demand-type.ts]
- **Gate de fase:** a coleta (1.6) leva a `status='scheduling'` quando nome+e-mail+resumo prontos — o formato é perguntado **nessa** fase. [Source: src/agent/tools/record-client-data.ts]

### Ordem do fluxo do Épico 2 (contexto p/ as instruções)
`scheduling` → **(2.2) formato** → **(2.3) ofertar slots** → **(2.4) confirmar** → **(2.5) criar + briefing** (`status='scheduled'`). Esta story é o primeiro passo dessa fase.

### O que NÃO fazer nesta story (escopo)
- ❌ Ofertar horários / consultar agenda (Story 2.3).
- ❌ Criar evento / persistir appointment (Story 2.5).
- ❌ Perguntar o formato antes de a coleta estar completa (respeitar o gate da 1.6).
- ❌ Emitir conteúdo jurídico (guardrail global da 1.4 continua valendo).

### Project Structure Notes
- **Novo:** `src/agent/tools/record-meeting-format.ts`. **Editado:** `src/agent/pre-atendimento.ts` (instruções + registrar tool). Alinhado à árvore (`agent/tools/`). [Source: architecture.md#Structure Patterns]

### Testing standards
- Sem testes automatizados (POC) — smoke com mock + `tsc --noEmit`. Testes que mockam externos usam **import dinâmico** após setar env (lição da 1.7). [Source: 1-7 Dev Agent Record]

### References
- [Source: epics.md#Story 2.2] — user story + ACs (FR-4)
- [Source: architecture.md#Requirements to Structure Mapping] — FR-4 vive em `pre-atendimento.ts` + (2.5) `create-appointment.ts`
- [Source: src/agent/tools/record-demand-type.ts] — padrão de tool a espelhar
- [Source: src/config.ts] — `officeAddress`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev) — agente da POC roda em `gpt-5.5`

### Debug Log References

- `npx tsc --noEmit` → exit 0.

### Completion Notes List

- Tool `recordMeetingFormat` criada espelhando `recordDemandType` (mesmo padrão tool+context+repo). Grava `meeting_format` (CHECK já existente na 0001), sem mexer em `status`.
- Instruções do agente estendidas: pergunta o formato só após a coleta completa; online→videochamada, presencial→endereço do escritório (`config.officeAddress`).
- Verificação conversacional ponta-a-ponta fica para a demo manual (depende de OpenAI+Supabase reais).

### File List

- `src/agent/tools/record-meeting-format.ts` (novo) — tool que grava `meeting_format`
- `src/agent/pre-atendimento.ts` (modificado) — import + bloco de instruções de formato + registro da tool
- `_bmad-output/implementation-artifacts/2-2-...md` (modificado) — checkboxes, Dev Agent Record, status
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificado) — status da 2.2

## Change Log

| Data       | Versão | Descrição                                                                | Autor        |
|------------|--------|--------------------------------------------------------------------------|--------------|
| 2026-06-10 | 0.1    | Escolha do formato: tool `recordMeetingFormat` + instruções. tsc OK.     | Amelia (dev) |
