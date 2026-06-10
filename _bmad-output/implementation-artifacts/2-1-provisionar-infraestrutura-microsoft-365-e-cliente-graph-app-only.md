---
baseline_commit: eb497074
---

# Story 2.1: Agenda simulada (fake calendar) — base do agendamento (POC)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> ⚠️ **PIVOT DE ESCOPO (POC) — 2026-06-10.** O escopo original desta story era *provisionar Microsoft 365 + cliente Graph app-only*. Decisão do Felyppe: **não integrar agenda real** — a licença Microsoft 365 (Exchange) virou uma barreira (sem caminho gratuito viável: Developer Program agora exige Visual Studio pago; conta pessoal/Azure não dá agenda; Google teria fricção equivalente). Para a POC, a agenda é **SIMULADA** por um fornecedor de mentira com a **mesma interface** que o Graph real teria. Trocar pelo real depois = reescrever só `integrations/calendar.ts`. As env vars `TENANT_ID/CLIENT_ID/CLIENT_SECRET/LUCAS_USER_ID` **permanecem opcionais** (não promover). Supersede o texto da Story 2.1 em `epics.md`/`architecture.md` (Microsoft Graph) para fins da demo.

## Story

As a Felyppe (desenvolvedor da POC),
I want um fornecedor de agenda SIMULADO com a mesma forma que o agente usaria de verdade,
so that o fluxo de agendamento do Épico 2 (formato → oferta de horários → confirmação → "criação" do evento + briefing) funcione na demo **sem depender de Microsoft 365/Graph nem de cartão**.

**Realiza:** Enabler do Épico 2 (substitui a integração real de calendário por uma simulada). Destrava FR-4/5/6/7/8 sem provisionamento externo.

## Acceptance Criteria

**AC1 — Helpers de data/horário (timezone Santos), puros, sem I/O**
**Given** `src/domain/datetime.ts` (módulo puro)
**When** gero a grade de horários de atendimento
**Then** ele produz **blocos de 1h, seg–sex, 9h–18h**, no fuso **America/Sao_Paulo**, para os próximos N dias úteis
**And** expõe um formatador de exibição em PT-BR (ex.: "seg 15/06 às 14h") para o texto do WhatsApp
**And** mantém a **constante de timezone Windows** `E. South America Standard Time` (`GRAPH_TIME_ZONE`) — preservada para uma futura troca pelo Graph real, sem custo agora.

**AC2 — Fornecedor de agenda SIMULADO com a interface do real**
**Given** `src/integrations/calendar.ts` (fornecedor simulado — único lugar que "fala com a agenda")
**When** o agente consulta disponibilidade e cria o evento (nas Stories 2.3/2.5)
**Then** `listBusy(from, to)` retorna uma lista de blocos **ocupados fictícios** (seed configurável; pode iniciar vazio) — o que permite à oferta de slots descontar horários "ocupados"
**And** `createEvent({ slot, attendees, format, briefingText })` **simula** a criação: retorna `{ eventId: <uuid>, joinUrl: <link Teams FALSO> | null, location: <endereço> | null }` (online → `joinUrl` falso; presencial → `location` = endereço do escritório do config) e **loga** `[calendar] (simulado) evento criado / convite enviado` — **nada real é enviado**
**And** a interface é a mesma que um cliente Graph real exporia, de modo que trocar para o Graph de verdade no futuro signifique **reescrever só este arquivo**.

**AC3 — Compila e demonstra coerência**
**Given** o código acima
**When** rodo `npx tsc --noEmit`
**Then** sai com exit 0
**And** um smoke descartável demonstra `listBusy` retornando os ocupados fictícios e `createEvent` retornando `eventId` + `joinUrl` falso (online) e `location` (presencial), com o log de simulação.

## Tasks / Subtasks

- [x] **Task 1 — `src/domain/datetime.ts` (puro, sem I/O)** (AC: 1)
  - [x] `GRAPH_TIME_ZONE` + `OUTLOOK_TIMEZONE_PREFER` (preservados p/ troca futura pelo Graph).
  - [x] `APP_TIME_ZONE = 'America/Sao_Paulo'`.
  - [x] `generateBusinessSlots(opts?: { days?: number }): Slot[]` — blocos de 1h, **seg–sex**, 9–18h (do config), próximos `days` (default 7), America/Sao_Paulo; pula fins de semana e horas já passadas de hoje.
  - [x] `formatSlotLabel(slot): string` → "seg 15/06 às 14h".
  - [x] Timezone explícito via `Intl.DateTimeFormat` + offset fixo `-03:00` (BR sem DST); nunca horário do servidor.
  - [x] Escopo mínimo respeitado: sem priorização/"máx. 3" (isso é a 2.3).

- [x] **Task 2 — `src/integrations/calendar.ts` (fornecedor SIMULADO)** (AC: 2)
  - [x] Singleton server-only no formato de `supabase-client.ts`/`evolution-client.ts`.
  - [x] `listBusy(fromIso, toIso)` → filtra `SEED_BUSY` (vazio por default; documentado como `getSchedule` futuro) por overlap no range.
  - [x] `createEvent({ slot, attendees, format, briefingText })` → `eventId` via `crypto.randomUUID()`; online → `joinUrl` Teams FALSO; presencial → `location` = `config.officeAddress`; loga "(simulado)"; **não** envia nem persiste.
  - [x] Log prefixo `[calendar]`, sem PII.
  - [x] Cabeçalho deixa claro que é simulado e que a troca = reescrever só este arquivo.

- [x] **Task 3 — Confirmar que NADA de Microsoft é promovido** (AC: 2)
  - [x] `config.ts` **não tocado** — vars Graph seguem `.optional()` (boot preservado).
  - [x] `@azure/identity`/`@microsoft/microsoft-graph-client` não usados (ficam ociosos no package.json).
  - [x] Reusa `config.officeAddress`, `config.businessHoursStart/End`.

- [x] **Task 4 — Verificação (smoke descartável)** (AC: 3)
  - [x] `npx tsc --noEmit` → exit 0.
  - [x] Smoke `tmp-calendar-smoke.ts` (env dummy + import dinâmico; **removido após rodar**): 43 slots seg–sex (a partir de "qua 10/06 às 11h"), 0 ocupados (seed vazio), evento online → `joinUrl` Teams falso, presencial → endereço do escritório.

## Dev Notes

### Por que simulado (decisão de POC) [Source: conversa 2026-06-10; architecture.md#Important Gaps]
- A agenda real (Microsoft Graph) exige **conta M365 work/school com Exchange Online** — barreira de licença/custo sem caminho gratuito viável hoje. Para a POC, o valor a demonstrar é o **fluxo conversacional de agendamento**, não a integração real. Por isso simulamos.
- **Princípio de fronteira preservado:** todo "I/O de agenda" vive só em `integrations/calendar.ts`. Trocar simulado→real depois = reescrever **um** arquivo, mantendo as assinaturas `listBusy`/`createEvent`. As tools (2.3/2.5) e o `domain/` não sabem se é real ou falso. [Source: architecture.md#Architectural Boundaries / #Enforcement Guidelines]

### Interface que o real teria (preservar as assinaturas)
- `listBusy(from, to)` ↔ no real: `getSchedule`/free-busy do Graph sobre `/users/{LUCAS_USER_ID}/calendar`.
- `createEvent(...)` ↔ no real: `POST /users/{id}/events` com `attendees` (dispara convite por e-mail), `isOnlineMeeting+teamsForBusiness` → `joinUrl` (online) ou `location` (presencial).
- Mantendo essas duas funções com a mesma forma, as Stories 2.3 (`getAvailability`) e 2.5 (`createAppointment`) ficam **idênticas** independente de ser simulado ou real. [Source: architecture.md#Agent Architecture]

### Dependência das stories anteriores / o que já existe
- **1.1** já criou `config.ts` com `officeAddress`, `businessHoursStart/End`, `timezone`, `maxSlots` (com defaults) — reusar, **não** recriar. [Source: config.ts]
- **Padrão de integração singleton** (`supabase-client.ts`, `evolution-client.ts`) e **padrão de erro/log** (`try/catch`, prefixo de contexto, sem PII) — `calendar.ts` segue igual. [Source: src/integrations/*; architecture.md#Process Patterns]
- **Config só via `config.ts`** (zod), nunca `process.env` espalhado. [Source: architecture.md#Enforcement Guidelines]

### Timezone (crítico p/ o Épico 2)
- Toda a grade de horários em **America/Sao_Paulo**. Nunca derivar slots do horário do servidor (UTC). A constante Windows `E. South America Standard Time` fica guardada em `datetime.ts` só para a troca futura pelo Graph; na simulação não é usada para chamada externa, mas mantém o arquivo pronto. [Source: architecture.md#Format Patterns]

### O que NÃO fazer nesta story (escopo)
- ❌ Integrar Microsoft Graph / `@azure/identity` / provisionar M365 — **cancelado** para a POC (simulado).
- ❌ Promover as vars Graph a obrigatórias no `config.ts` (devem seguir opcionais).
- ❌ Criar a tool `getAvailability` (Story 2.3), o fluxo de formato/confirmação (2.2/2.4) ou `createAppointment` + tabela `appointments` (Story 2.5). Esta story só entrega os **helpers de data** e o **fornecedor simulado**.
- ❌ Persistir `appointments` aqui (a tabela/migration `0002` e o `appointment-repo` são da Story 2.5; aqui `createEvent` é stateless e só simula o lado externo).
- ❌ Tocar no fluxo de WhatsApp / instruções do agente (nada conversacional muda nesta story).

### Impacto nas próximas stories (registrar p/ não surpreender)
- **2.3 (getAvailability):** chama `calendar.listBusy` + `domain/datetime.generateBusinessSlots` + aplica "máx. 3" e priorização da preferência. Sem mudança vs. plano, só a fonte é simulada.
- **2.5 (createAppointment):** chama `calendar.createEvent` (simulado), persiste em `appointments` (migration 0002), e — para a **consistência de agenda (NFR-2)** na demo — passa a considerar os `appointments` já marcados como "ocupados" (pode injetar no `listBusy` ou checar no repo). Assim "horário reservado some da próxima oferta" mesmo simulado.

### Project Structure Notes
- **Novos:** `src/domain/datetime.ts`, `src/integrations/calendar.ts`. **Editado:** nada obrigatório no `config.ts` (só reuso). Alinhado à árvore da arquitetura (`domain/datetime.ts`, `integrations/` — o nome `calendar.ts` substitui o `graph-client.ts` previsto, por ser simulado). [Source: architecture.md#Complete Project Directory Structure]
- Sem migration nesta story.

### Testing standards
- Sem testes automatizados (POC) — validação via smoke descartável + `tsc --noEmit`. [Source: architecture.md]

### References
- [Source: conversa 2026-06-10] — decisão de simular a agenda (POC); Microsoft/Google têm fricção de licença
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1 / #Epic 2] — escopo original (Graph) substituído pela simulação; FRs do Épico 2 inalterados no fluxo
- [Source: _bmad-output/planning-artifacts/architecture.md#Agent Architecture] — assinaturas `getAvailability`/`createAppointment` que as 2.3/2.5 usam (preservadas)
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural Boundaries] — I/O de agenda isolado em `integrations/` (troca simulado→real = 1 arquivo)
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns] — slots seg–sex 9–18h, 1h, America/Sao_Paulo; constante de timezone Windows
- [Source: src/config.ts] — `officeAddress`, `businessHoursStart/End`, `timezone`, `maxSlots` já disponíveis

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev) — agente da POC roda em `gpt-5.5`

### Debug Log References

- `npx tsc --noEmit` → exit 0.
- Smoke `tmp-calendar-smoke.ts` (descartável, removido): `generateBusinessSlots({days:7})` → 43 slots seg–sex 9–18h começando em "qua 10/06 às 11h" (descontando horas já passadas de hoje); `listBusy` → 0 (seed vazio); `createEvent` online → `joinUrl: https://teams.microsoft.com/l/meetup-join/SIMULADO/<uuid>`, presencial → `location: Rua Maria Máximo 153, Ponta da Praia, Santos/SP`.

### Completion Notes List

- **Agenda 100% simulada** (sem Microsoft 365/Graph, sem cartão): `integrations/calendar.ts` é o único ponto de "I/O" de agenda — `listBusy` (seed em memória) e `createEvent` (id uuid + Teams falso/endereço, só loga, não envia/persiste). Trocar pelo real depois = reescrever só este arquivo.
- **`domain/datetime.ts` puro**: grade seg–sex 9–18h em America/Sao_Paulo (offset fixo -03:00, BR sem DST), pula fim de semana e horas passadas; `formatSlotLabel` em PT-BR. Constante de timezone Windows do Graph preservada para troca futura.
- **Vars Microsoft seguem opcionais** no `config.ts` (não promovidas) → boot/WhatsApp em produção preservados.
- **Pendência (não bloqueia):** nenhuma — não há provisionamento externo nesta versão simulada.

### File List

- `src/domain/datetime.ts` (novo) — helpers de data/horário puros (America/Sao_Paulo) + constantes de timezone Graph
- `src/integrations/calendar.ts` (novo) — fornecedor de agenda SIMULADO (`listBusy`/`createEvent`)
- `_bmad-output/implementation-artifacts/2-1-...md` (modificado) — checkboxes, Dev Agent Record, status
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificado) — status da 2.1

## Change Log

| Data       | Versão | Descrição                                                                 | Autor        |
|------------|--------|---------------------------------------------------------------------------|--------------|
| 2026-06-10 | 0.1    | Agenda simulada (pivot POC): `domain/datetime.ts` + `integrations/calendar.ts`. tsc + smoke OK. | Amelia (dev) |
