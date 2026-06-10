---
baseline_commit: eb497074
---

# Story 2.3: Consulta de disponibilidade e oferta de Slots

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> ℹ️ **Agenda SIMULADA (POC).** A "consulta à agenda do Lucas" usa o fornecedor simulado `integrations/calendar.ts` (Story 2.1): `listBusy` retorna ocupados fictícios. O `domain/slots.ts` filtra/prioriza. Trocar pelo Graph real depois não muda esta story. [Source: 2-1 story]

## Story

As a Cliente,
I want receber horários livres reais da agenda do advogado,
so that eu escolha um horário que de fato esteja disponível.

**Realiza:** FR-5, NFR-2 (parte), NFR-3.

## Acceptance Criteria

**AC1 — Oferta só de horários livres, dentro da janela, no máximo 3, priorizando preferência**
**Given** a tool `getAvailability(prefs)` que consulta a agenda (simulada: `calendar.listBusy`) e gera Slots em `domain/slots.ts`
**When** a IA oferece horários
**Then** são oferecidos **apenas** Slots livres no momento da consulta (a agenda é a fonte da verdade), **nunca** um horário ocupado
**And** os Slots respeitam **seg–sex, 9h–18h, blocos de 1h**, no máximo **`config.maxSlots`** (default 3) por vez, priorizando a preferência de horário coletada (`collected.timePreference`, FR-3)
**And** Slots fora dessa janela não são oferecidos.

**AC2 — Apresentação em texto puro numerado + timezone**
**Given** a lista de Slots
**When** a IA a apresenta ao Cliente
**Then** é texto puro com itens numerados (`1)`, `2)`, `3)`), sem markdown
**And** a geração usa **America/Sao_Paulo** (via `domain/datetime.ts`, Story 2.1).

## Tasks / Subtasks

- [x] **Task 1 — `src/domain/slots.ts` (puro, sem I/O)** (AC: 1, 2)
  - [x] `generateSlots(input: { busy: { startIso; endIso }[]; timePreference?: string; max: number; days?: number }): Slot[]` onde `Slot = { startIso; endIso; label }`:
    1. partir da grade de `datetime.generateBusinessSlots` (2.1 — seg–sex 9–18h, 1h, America/Sao_Paulo)
    2. **remover** blocos que colidem com qualquer intervalo de `busy` (overlap = início < fimBusy && fim > inícioBusy)
    3. **priorizar** segundo `timePreference` (texto livre coletado — ex. "de manhã", "terça à tarde"): heurística leve (manhã < 12h; tarde ≥ 12h; dia da semana citado), sem ser determinística demais — ordenar os livres pela aderência à preferência, mantendo cronológico como desempate
    4. cortar em `max` (default `config.maxSlots`)
    5. anexar `label` via `datetime.formatSlotLabel`
  - [x] **Puro**: recebe `busy` por parâmetro (não chama I/O). Testável isoladamente. [Source: architecture.md#Component Boundaries — domain puro]

- [x] **Task 2 — Tool `getAvailability` (`src/agent/tools/get-availability.ts`)** (AC: 1, 2)
  - [x] `tool({ name: 'getAvailability', description, parameters: z.object({ timePreference: z.string().nullish() }), execute })`.
  - [x] `execute` (recebe `conversationId` via `context`):
    1. validar contexto
    2. definir o range de busca (próximos ~5 dias úteis a partir de agora em America/Sao_Paulo)
    3. `busy = await calendar.listBusy(rangeFromIso, rangeToIso)` (simulado — 2.1)
    4. carregar `collected.timePreference` da conversa (se a IA não passar no param) via `conversationRepo`
    5. `slots = generateSlots({ busy, timePreference, max: config.maxSlots })`
    6. **persistir os slots ofertados** em `conversations.collected.offeredSlots` (via `conversationRepo.updateCollected`) para que a Story 2.4 mapeie "opção 2" → slot real entre turnos — ver Dev Notes "Slots ofertados sobrevivem ao turno"
    7. retornar `{ ok: true, slots }` (cada um com `label`) ou `{ ok:false, reason }` se não houver slot (a IA pede outra preferência ou amplia o range)
  - [x] Registrar a tool no agente.

- [x] **Task 3 — Instruções: quando ofertar e como apresentar** (AC: 1, 2)
  - [x] Estender `pre-atendimento.ts`: **só** ofertar horários **depois** do formato escolhido (2.2) e com a coleta completa. Chamar `getAvailability`; apresentar os slots como **lista numerada em texto puro** (`1) seg 15/06 às 14h`).
  - [x] **Nunca** inventar horários nem oferecer fora da lista retornada pela tool (a tool é a fonte). Se a tool retornar vazio, pedir outra preferência/período com cordialidade.

- [x] **Task 4 — Verificação manual (demo)** (AC: 1, 2)
  - [x] `npx tsc --noEmit` → exit 0.
  - [x] Smoke: com `listBusy` simulando 1–2 ocupados, `getAvailability` retorna ≤ `maxSlots` livres, nenhum colidindo com os ocupados, todos seg–sex 9–18h; `offeredSlots` persistido no `collected`.

## Dev Notes

### Dependência das stories anteriores / o que já existe (2.1)
- **`integrations/calendar.ts`** (`listBusy`) e **`domain/datetime.ts`** (`generateBusinessSlots`, `formatSlotLabel`, `APP_TIME_ZONE`) vêm da Story 2.1 (simulado). Reusar — **não** recriar geração de grade nem timezone. [Source: 2-1 story]
- **`config.maxSlots`** (default 3) e **`config.businessHoursStart/End`** já no config (1.1). [Source: src/config.ts]
- **`collected` jsonb** já é mesclado por `conversationRepo.updateCollected` (read-merge-write — 1.6) — usar para `offeredSlots` sem perder os dados do cliente. [Source: src/repos/conversation-repo.ts]

### Slots ofertados sobrevivem ao turno (importante p/ a 2.4)
- O Cliente responde "o **2**" num turno seguinte; a janela de histórico (20 msgs) e o estado precisam permitir mapear a opção ao slot. Persistir `collected.offeredSlots = [{ startIso, endIso, label }]` aqui torna a confirmação (2.4) e a criação (2.5) robustas — a IA não precisa re-gerar nem adivinhar. [Source: src/agent/runner.ts — nota de estado no input]

### Consistência de agenda (NFR-2) — papel desta story
- Aqui garantimos **não ofertar ocupado** no momento da consulta. A re-checagem **na criação** (corrida oferta↔confirmação) é da Story 2.5. Na 2.5, o `busy` passará a incluir também os `appointments` já marcados (trava). [Source: epics.md NFR-2; 2-1 Dev Notes "Impacto nas próximas stories"]

### O que NÃO fazer nesta story (escopo)
- ❌ Confirmar/criar o evento (Stories 2.4/2.5).
- ❌ Persistir `appointments` (tabela é da 2.5).
- ❌ Pôr regra de slots dentro da tool — a regra vive em `domain/slots.ts` (tool só orquestra). [Source: architecture.md#Enforcement Guidelines]
- ❌ Gerar datas com horário do servidor (UTC) — usar America/Sao_Paulo. [Source: architecture.md#Anti-patterns]

### Project Structure Notes
- **Novos:** `src/domain/slots.ts`, `src/agent/tools/get-availability.ts`. **Editado:** `pre-atendimento.ts` (instruções + registrar tool). Alinhado à árvore. [Source: architecture.md#Structure Patterns]

### Testing standards
- Sem testes automatizados (POC) — smoke + `tsc --noEmit`. `domain/slots.ts` é puro e fácil de exercitar isoladamente no smoke. [Source: architecture.md]

### References
- [Source: epics.md#Story 2.3] — user story + ACs (FR-5, NFR-2 parte, NFR-3)
- [Source: architecture.md#Agent Architecture] — `getAvailability(prefs)` → `domain/slots` + agenda como fonte da verdade
- [Source: architecture.md#Requirements to Structure Mapping] — FR-5 = `get-availability.ts` + `domain/slots.ts` + (simulado) `calendar.ts`
- [Source: 2-1 story] — `calendar.listBusy`, `datetime.generateBusinessSlots`/`formatSlotLabel`
- [Source: src/repos/conversation-repo.ts] — `updateCollected` (merge) para `offeredSlots`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev) — agente da POC roda em `gpt-5.5`

### Debug Log References

- `npx tsc --noEmit` → exit 0.
- Smoke `tmp-slots-smoke.ts` (removido): com os 2 primeiros blocos da grade ocupados, `generateSlots` (sem pref) → `[qua 10/06 13h, 14h, 15h]` (nenhum nos ocupados); pref "à tarde" → todos ≥12h.

### Completion Notes List

- **`domain/slots.ts` puro**: recebe `busy` por parâmetro, remove colisões, prioriza preferência (manhã/tarde/dia da semana via heurística leve) com desempate cronológico, corta em `config.maxSlots`.
- **Tool `getAvailability`**: orquestra `calendar.listBusy` (simulado) + `generateSlots`; usa `timePreference` do param ou do estado (`collected.timePreference`, 1.6); **persiste `collected.offeredSlots`** (via `updateCollected`, merge) p/ a confirmação (2.4) mapear índice→slot; devolve `{ index, label }` à IA.
- **Tipos**: `OfferedSlot` adicionado em `types.ts`; `CollectedData` ganhou `offeredSlots`/`selectedSlot` (jsonb flexível).
- **Instruções**: ofertar só após o formato; apresentar lista numerada em texto puro; nunca inventar horário fora da lista da tool.
- Verificação conversacional end-to-end é manual (depende de OpenAI+Supabase reais); a regra pura foi validada no smoke.

### File List

- `src/domain/slots.ts` (novo) — regra pura de oferta de slots (filtro + priorização)
- `src/agent/tools/get-availability.ts` (novo) — tool de disponibilidade (calendar + slots + persiste offeredSlots)
- `src/types.ts` (modificado) — `OfferedSlot` + `offeredSlots`/`selectedSlot` em `CollectedData`
- `src/agent/pre-atendimento.ts` (modificado) — import + bloco de oferta de horários + registro da tool
- `_bmad-output/implementation-artifacts/2-3-...md` (modificado) — checkboxes, Dev Agent Record, status
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificado) — status da 2.3

## Change Log

| Data       | Versão | Descrição                                                                  | Autor        |
|------------|--------|----------------------------------------------------------------------------|--------------|
| 2026-06-10 | 0.1    | Oferta de slots: `domain/slots.ts` + tool `getAvailability` + `offeredSlots` no estado. tsc + smoke OK. | Amelia (dev) |
