---
baseline_commit: eb497074
---

# Story 2.4: Confirmação do horário

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Cliente,
I want confirmar o horário antes de fechar,
so that eu não seja agendado em um horário errado.

**Realiza:** FR-6, NFR-2.

## Acceptance Criteria

**AC1 — Repetir e pedir confirmação explícita antes de criar**
**Given** o Cliente escolheu um Slot oferecido (um dos `collected.offeredSlots`, Story 2.3)
**When** a IA registra a escolha
**Then** ela **repete data, hora e formato** e pede **confirmação explícita** ("posso confirmar esse horário?") antes de criar o Convite
**And** **não cria nada** sem o "sim" do Cliente (a tool `createAppointment` da 2.5 só é chamada após a confirmação).

**AC2 — Slot indisponível entre oferta e confirmação → reoferecer**
**Given** o Slot escolhido
**When** ele ficou indisponível entre a oferta e a confirmação (detectado na re-checagem da criação — Story 2.5)
**Then** a IA avisa o Cliente e **reoferece** novos Slots (volta à Story 2.3, chamando `getAvailability` de novo)
**And** a velocidade de agendar **nunca** pula a confirmação (counter-metric SM-C2).

## Tasks / Subtasks

- [x] **Task 1 — Instruções: gate de confirmação explícita** (AC: 1)
  - [x] Estender `pre-atendimento.ts` (bloco "Confirmação"): quando o Cliente escolher uma opção da lista (ex. "o 2", "pode ser o das 14h"), a IA **mapeia** para o slot real em `collected.offeredSlots`, **repete em texto puro** data + hora + formato (ex.: "Então fica: **terça 16/06 às 14h**, **online**. Posso confirmar? 🙂") e **aguarda o "sim"**.
  - [x] **Regra dura:** só chamar `createAppointment` (2.5) **depois** da confirmação explícita. Nunca criar no mesmo turno da oferta, nunca "adivinhar" o sim. [Source: epics.md FR-6; SM-C2]
  - [x] Se o Cliente quiser outro horário ou nenhum servir → chamar `getAvailability` de novo (reoferecer), sem criar nada.

- [x] **Task 2 — Registrar o slot selecionado + fase `confirming`** (AC: 1, 2)
  - [x] Persistir o slot escolhido em `conversations.collected.selectedSlot = { startIso, endIso, label }` (via `conversationRepo.updateCollected`) quando a IA apresentar a confirmação — sobrevive ao turno e alimenta a `createAppointment` (2.5). [Source: 2-3 Dev Notes "Slots ofertados sobrevivem ao turno"]
  - [x] Atualizar `status = 'confirming'` (valor já no CHECK da migration 0001) ao entrar no aguardo do "sim". Pode ser feito por uma tool leve `recordSlotSelection({ index })` (mapeia o índice → `offeredSlots[index]`, grava `selectedSlot` + `status='confirming'`) OU dentro do próprio fluxo de `getAvailability`/instruções — **preferir a tool** `recordSlotSelection` para manter o mapeamento determinístico (não confiar no LLM para copiar ISO de data). Ver Dev Notes.
  - [x] **Não** marcar `scheduled` aqui (isso é só após a criação na 2.5).

- [x] **Task 3 — Reoferta quando o slot caiu (liga com a 2.5)** (AC: 2)
  - [x] Nas instruções: se `createAppointment` (2.5) retornar `{ ok:false, reason:'slot_taken' }`, a IA **avisa com cortesia** que o horário acabou de ser ocupado e **chama `getAvailability`** para reoferecer — sem opinar nem prometer. (A detecção real da corrida é da 2.5; aqui é o comportamento conversacional.)

- [x] **Task 4 — Verificação manual (demo)** (AC: 1, 2)
  - [x] `npx tsc --noEmit` → exit 0.
  - [x] Smoke/conversa: ofertar slots → escolher "2" → IA repete data/hora/formato e pede confirmação → sem "sim", **nada é criado** (`status='confirming'`, `selectedSlot` gravado). Após "sim", segue para a 2.5.

## Dev Notes

### Dependência das stories anteriores / o que já existe
- **`collected.offeredSlots`** é persistido pela Story 2.3 — esta story **mapeia a escolha do Cliente** para um desses slots (índice → slot real). Não pedir ao LLM para reescrever a data em ISO (fonte de erro); usar o índice sobre `offeredSlots`. [Source: 2-3 story]
- **`conversations.status='confirming'`** e os demais valores já estão no CHECK (migration 0001). [Source: supabase/migrations/0001_init.sql]
- **Padrão tool + `context`** (1.5–1.7) para `recordSlotSelection`, se adotada. [Source: src/agent/tools/record-demand-type.ts]
- **Nota de estado no input** (runner, correção do code-review) já injeta fase + dados — ajuda a IA a saber que está em `confirming`. [Source: src/agent/runner.ts]

### Por que uma tool de seleção (recomendado)
- Mapear "o 2" → `offeredSlots[1]` de forma **determinística** evita o LLM copiar data/hora errada. A tool grava `selectedSlot` e `status='confirming'`; a 2.5 lê `selectedSlot` (não reinterpreta texto). Mantém a confirmação à prova de erro. [Source: architecture.md#Process Patterns — determinismo onde possível]

### Consistência (NFR-2) — divisão com a 2.5
- A **confirmação** é o gate humano (esta story). A **re-checagem técnica** do slot (corrida oferta↔confirmação) acontece na criação (Story 2.5, `createAppointment` re-chama `listBusy`/checa `appointments`). Se cair, a 2.5 devolve `slot_taken` e a IA reoferece (Task 3). [Source: epics.md NFR-2; architecture.md#Idempotência/consistência]

### O que NÃO fazer nesta story (escopo)
- ❌ Criar o evento / persistir `appointment` (Story 2.5) — aqui só confirma e marca `confirming`.
- ❌ Criar sem confirmação explícita (viola FR-6 / SM-C2).
- ❌ Reescrever a geração/oferta de slots (Story 2.3).
- ❌ Emitir conteúdo jurídico (guardrail global 1.4).

### Project Structure Notes
- **Editado:** `src/agent/pre-atendimento.ts` (instruções de confirmação). **Novo (opcional, recomendado):** `src/agent/tools/record-slot-selection.ts`. Sem migration. Alinhado à árvore. [Source: architecture.md#Structure Patterns]

### Testing standards
- Sem testes automatizados (POC) — smoke + `tsc --noEmit`. Foco: **nada é criado sem o "sim"**. [Source: architecture.md]

### References
- [Source: epics.md#Story 2.4] — user story + ACs (FR-6, NFR-2)
- [Source: architecture.md#Requirements to Structure Mapping] — FR-6 = `pre-atendimento.ts` + re-checagem em `create-appointment.ts`
- [Source: 2-3 story] — `collected.offeredSlots` (mapa índice→slot)
- [Source: src/agent/runner.ts] — nota de estado (fase/coletados) no input

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev) — agente da POC roda em `gpt-5.5`

### Debug Log References

- `npx tsc --noEmit` → exit 0.

### Completion Notes List

- **Tool `recordSlotSelection`**: mapeia o NÚMERO escolhido → `collected.offeredSlots[index-1]` de forma determinística (o LLM não copia ISO), grava `collected.selectedSlot` e move `status='confirming'`. Índice fora da lista → `{ ok:false, reason:'indice_invalido' }` (a IA reoferece).
- **Instruções (gate crítico)**: ao escolher, chama `recordSlotSelection`; repete data/hora/formato em texto puro; **só** chama `createAppointment` (2.5) após "sim" explícito; nunca cria sem confirmação. Inclui o caminho de reoferta em `slot_taken` (liga 2.5→2.3).
- Re-checagem técnica da corrida oferta↔confirmação fica na 2.5 (`createAppointment`); aqui é o gate humano + persistência determinística do slot.
- Verificação conversacional end-to-end é manual (OpenAI+Supabase reais).

### File List

- `src/agent/tools/record-slot-selection.ts` (novo) — mapeia índice→slot, grava `selectedSlot` + `status='confirming'`
- `src/agent/pre-atendimento.ts` (modificado) — import + bloco de confirmação + registro da tool
- `_bmad-output/implementation-artifacts/2-4-...md` (modificado) — checkboxes, Dev Agent Record, status
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificado) — status da 2.4

## Change Log

| Data       | Versão | Descrição                                                                | Autor        |
|------------|--------|--------------------------------------------------------------------------|--------------|
| 2026-06-10 | 0.1    | Confirmação: tool `recordSlotSelection` (índice→slot, `confirming`) + gate de confirmação explícita. tsc OK. | Amelia (dev) |
