---
baseline_commit: aa6e2a746414bd9f2b9d981817a3dbd43a776ec2
---

# Story 1.6: Coleta conversacional de dados do Cliente

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Cliente,
I want informar meus dados naturalmente durante a conversa,
so that o escritório tenha o necessário para marcar a reunião sem parecer um formulário.

**Realiza:** FR-3.

## Acceptance Criteria

**AC1 — Coleta conversacional + validação de e-mail**
**Given** a demanda já triada e confirmada (`status = 'collecting'`)
**When** a IA conduz a coleta
**Then** ela obtém **nome completo, e-mail, resumo do caso e preferência de horário** de forma conversacional, registrando em `conversations.collected` (jsonb); o telefone vem do próprio WhatsApp
**And** o e-mail é **validado em formato** (zod); se inválido, a IA **pede novamente**.

**AC2 — Gate: não avança sem nome, e-mail e resumo**
**Given** a coleta em andamento
**When** nome, e-mail **ou** resumo do caso ainda **não** foram coletados
**Then** a IA **não** avança para a etapa de agendamento (oferta de Slots)
**And** a **preferência de horário** (período/dia) é registrada para priorizar a oferta de Slots posteriormente (FR-5).

## Tasks / Subtasks

- [x] **Task 1 — Tipo `Collected` + shape do jsonb** (AC: 1, 2)
  - [x] Em `src/types.ts`, definir `Collected { name?: string; email?: string; caseSummary?: string; timePreference?: string }` (camelCase; persistido em `conversations.collected`)
  - [x] Confirmar que `Conversation.collected` (da 1.2) usa esse tipo
- [x] **Task 2 — Merge parcial de `collected` no repo** (AC: 1, 2)
  - [x] Adicionar `conversation-repo.updateCollected(conversationId, partial: Collected): Promise<Conversation>` que **mescla** (carrega o `collected` atual → spread dos novos campos → grava) — **não** sobrescrever o objeto inteiro (senão perde campos já coletados)
  - [x] Renovar `updated_at`. Conversão snake↔camel só no repo. (Serialização por telefone da 1.3 garante que o read-merge-write não corre risco de corrida.) [Source: 1-3 fila por telefone; architecture.md#Communication Patterns]
- [x] **Task 3 — Tool `recordClientData` (`src/agent/tools/record-client-data.ts`)** (AC: 1, 2)
  - [x] `tool({ name: 'recordClientData', description, parameters: z.object({ name: z.string().optional(), email: z.string().optional(), caseSummary: z.string().optional(), timePreference: z.string().optional() }), execute })`
  - [x] **Validação de e-mail dentro do `execute`** (não no schema da tool): se `email` veio, validar com `z.string().email().safeParse(email)`; se inválido → retornar `{ ok: false, reason: 'invalid_email' }` para a IA **pedir novamente** (controle da mensagem fica com o agente). Validar no schema faria o SDK rejeitar o argumento antes, sem mensagem amigável. [Source: epics.md FR-3 "se inválido, a IA pede novamente"]
  - [x] Persistir os campos válidos via `conversation-repo.updateCollected`
  - [x] Após o merge, se **nome + e-mail + resumo** estiverem todos presentes, transicionar `status = 'scheduling'` (libera o Épico 2); senão manter `collecting`. Retornar no resultado o que **ainda falta** (ex.: `{ ok: true, missing: ['caseSummary'] }`) para a IA conduzir a próxima pergunta
  - [x] Registrar a tool no agente (`tools: [recordDemandType, recordClientData]`)
  - [x] `conversationId` chega via `context` do `run` (mesmo mecanismo da 1.5)
- [x] **Task 4 — Estender instruções do agente (coleta)** (AC: 1, 2)
  - [x] Acrescentar às instruções a etapa de **coleta** após a triagem confirmada (ver Dev Notes "Instruções — coleta"):
    - coletar nome completo, e-mail, resumo do caso (2–3 linhas) e preferência de horário, de forma **conversacional** (não um formulário), idealmente uma coisa de cada vez
    - chamar `recordClientData` conforme as informações chegam (pode ser incremental)
    - se a tool retornar `invalid_email` → pedir o e-mail novamente, com gentileza
    - **gate:** **não** oferecer agendamento/horários enquanto faltar nome, e-mail **ou** resumo (a tool informa o que falta)
    - a preferência de horário é registrada para priorizar Slots depois (FR-5), mas **não** bloqueia o avanço
  - [x] Telefone **não** é perguntado (vem do WhatsApp). [Source: epics.md FR-3]
- [x] **Task 5 — Verificação manual (demo da story)** (AC: 1, 2)
  - [x] Fluxo feliz: após triagem, a IA pede e coleta nome → e-mail → resumo → preferência; `conversations.collected` preenche incrementalmente; ao completar nome+e-mail+resumo, `status = 'scheduling'`
  - [x] E-mail inválido ("joao@", "joao gmail") → IA pede de novo; só persiste quando válido
  - [x] Tentar "pular" para agendamento sem resumo → IA **não** avança e volta a pedir o que falta
  - [x] Conferir `collected` (jsonb) no banco com os 4 campos em camelCase

## Dev Notes

### Dependência das stories anteriores
- **1.5** deixou a conversa em `status = 'collecting'` com `demand_type` definido, e estabeleceu o padrão **tool + `context` do `run`** (`recordDemandType`). Esta story segue o mesmo padrão com `recordClientData`. [Source: 1-5 story]
- **1.2** definiu `conversations.collected jsonb` e `conversation-repo`. Esta story **adiciona** `updateCollected` (merge parcial). [Source: 1-2 Dev Notes]
- **1.4** definiu instruções/runner/guardrail — estendidos aqui. Guardrail jurídico (NFR-1) continua global.

### Por que merge parcial (e não overwrite) do `collected`
- A coleta é **incremental** (nome num turno, e-mail noutro…). Se a tool gravar o objeto inteiro a cada chamada, apaga o que já havia. Por isso `updateCollected` faz **read-merge-write**. A serialização por telefone (1.3) garante que dois turnos do mesmo Cliente não colidam nesse read-merge-write. [Source: architecture.md#Communication Patterns "uma escrita por turno"]
- Alternativa (Postgres) seria `collected || '{...}'::jsonb` (concatenação jsonb) numa única query — também válida; escolha uma e mantenha a conversão no repo.

### Validação de e-mail — onde e como [Source: epics.md FR-3; architecture.md#Data Architecture "zod p/ dados coletados"]
- Usar `z.string().email()` (zod, já no stack) **dentro do `execute`** via `safeParse`, retornando `{ ok:false, reason:'invalid_email' }` quando inválido, para a IA re-perguntar com mensagem natural.
- **Não** colocar `.email()` no schema de `parameters` da tool: a validação de argumentos do SDK rejeitaria a chamada antes do `execute`, sem permitir a re-pergunta controlada.

### Instruções — coleta (estender as da 1.4/1.5)
Acrescentar (PT-BR), tom cordial, texto puro WhatsApp:
- "Depois que o Tipo de Demanda for confirmado, **colete de forma conversacional** (uma coisa de cada vez, sem parecer formulário): **nome completo**, **e-mail**, um **resumo do caso** (2–3 linhas) e a **preferência de horário** (período/dia)."
- "Registre os dados chamando `recordClientData` conforme forem surgindo. Se o e-mail for recusado (`invalid_email`), peça novamente com gentileza."
- "**Não** ofereça horários/agendamento enquanto faltar **nome, e-mail ou resumo** — a tool indica o que ainda falta; conduza a conversa para completar."
- "**Não** peça o telefone (já temos pelo WhatsApp)."
- "A preferência de horário serve para priorizar os horários depois; registre-a, mas ela não é obrigatória para avançar."
- Outcome-first (gpt-5.5): diga o objetivo (ter nome+e-mail+resumo válidos) e o limite (gate), sem microgerenciar a ordem exata. [Source: openaiDeveloperDocs#latest-model]

### O gate (AC2) — defesa em camadas
- Nesta story o gate é **instrucional** (o agente não oferece agendamento sem os 3 campos) + **de estado** (`status` só vira `scheduling` quando completos).
- No **Épico 2**, a tool `getAvailability` deve **revalidar** que nome+e-mail+resumo existem antes de ofertar Slots (defesa em profundidade) — anotar como nota para a Story 2.3, **não** implementar aqui. [Source: epics.md FR-5; architecture.md#Agent Architecture]

### Fronteiras e padrões [Source: architecture.md#Enforcement Guidelines]
- Tool orquestra; validação (e-mail/zod) é regra simples no `execute`; persistência via `conversation-repo`. Sem SQL solto, sem `process.env`, texto puro.
- `collected` trafega em **camelCase** na app; conversão só no repo.

### O que NÃO fazer nesta story (escopo)
- ❌ Oferecer horários/Slots, consultar agenda ou tocar em Microsoft Graph (Épico 2).
- ❌ Pedir telefone ao Cliente.
- ❌ Sobrescrever `collected` inteiro (use merge).
- ❌ Pôr `.email()` no schema da tool (impede a re-pergunta amigável).
- ❌ Avançar de fase sem nome+e-mail+resumo.
- ❌ Emitir opinião jurídica (NFR-1).

### Project Structure Notes
- Arquivos: `src/agent/tools/record-client-data.ts` (novo), edição de `src/agent/pre-atendimento.ts` (instruções + registrar tool), `src/repos/conversation-repo.ts` (add `updateCollected`), `src/types.ts` (add `Collected`). Alinhado à árvore. [Source: architecture.md#Complete Project Directory Structure]

### Testing standards
- Sem testes automatizados (POC) — verificação manual (Task 5) via WhatsApp + inspeção de `collected`/`status` + Traces. [Source: architecture.md]

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6] — user story + ACs (FR-3)
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — `collected` jsonb, validação zod, e-mail
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements to Structure Mapping] — FR-3 → pre-atendimento.ts + conversation-repo + zod
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Guidelines] — fronteiras, camelCase, texto puro
- [Source: openaiDeveloperDocs#agents/quickstart] — `tool({...})`; [#latest-model] — prompts outcome-first
- [Source: 1-5-...triagem.md] — padrão tool + context; transição para `collecting`
- [Source: 1-2-...supabase.md] — `collected` jsonb, conversation-repo

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev) — agente da POC roda em `gpt-5.5`

### Debug Log References

- `npx tsc --noEmit` → exit 0.
- **Verificação com conversa REAL completa (gpt-5.5)** via script descartável `tmp-collect-test.ts` (chamou `runTurn` direto; sem WhatsApp): triagem → coleta incremental → e-mail inválido → e-mail válido → tentativa de pular → resumo → preferência.
- **Estado final confirmado via MCP** (phone de teste): `status='scheduling'`, `demand_type='locacao'`, `collected = { name:'João da Silva Santos', email:'joao.silva@gmail.com', caseSummary:'...', timePreference:'manhã' }` — 4 campos em camelCase. Dados truncados ao final.
- Outcomes verificados (todos OK): nome gravado incrementalmente; **e-mail inválido `joao@gmail` NÃO persistido** (tool retorna `invalid_email`, IA pede de novo: *"acho que faltou uma parte do e-mail..."*); e-mail válido gravado; **gate respeitado** (não vai p/ scheduling sem os 3 campos); completo → `status='scheduling'`; preferência registrada.
- **Bug encontrado e corrigido durante o teste:** o modelo re-chama `recordDemandType` em turnos seguintes (histórico reproduzido); como a tool setava `status='collecting'` incondicionalmente, isso **regredia** o status. Corrigido: a tool agora lê o status atual (`findById`) e só avança `greeting`/`triaging` → `collecting`, nunca retrocede. Verificado: re-mencionar o tipo após `scheduling` mantém `scheduling`.
- Nota: assertivas de **estado intermediário** no script são sensíveis a timing (o LLM varia em qual turno chama a tool); o estado final e todos os ACs foram satisfeitos (confirmado no banco).

### Completion Notes List

- **Coleta incremental sem formulário:** tool `recordClientData` aceita campos parciais e é chamada conforme a conversa flui; `conversation-repo.updateCollected` faz **read-merge-write** (não sobrescreve o `collected` inteiro — preserva o já coletado). Serialização por telefone (1.3) protege o merge de corrida.
- **Validação de e-mail no `execute`** (não no schema da tool, de propósito) via `z.email().safeParse`: e-mail inválido → `{ ok:false, reason:'invalid_email' }`, deixando a IA re-perguntar com mensagem natural. Telefone nunca é pedido (vem do WhatsApp).
- **Gate (AC2) em camadas:** instrucional (IA não oferece agenda sem nome+e-mail+resumo) + de estado (a tool só promove `status='scheduling'` quando os 3 estão presentes; retorna `missing` para a IA conduzir). No Épico 2, `getAvailability` deve revalidar isso (defesa em profundidade) — anotado para a Story 2.3.
- `Collected` adicionado como alias de `CollectedData` (que já tinha os 4 campos desde a 1.2).
- `findById` adicionado ao `conversation-repo` (usado pela correção de não-regressão e útil em geral).
- Guardrail jurídico global (1.4) e fronteiras (tool orquestra · validação simples no execute · repo faz I/O · camelCase só na app) mantidos.
- **Escopo respeitado:** nada de oferta de horários/Slots ou Microsoft Graph (Épico 2); só coleta + gate + transição para `scheduling`.
- **Pendência de Felyppe (Task 5 com WhatsApp real, pós-deploy):** validar a coleta via WhatsApp (incl. e-mail inválido e tentativa de pular o gate) e conferir `collected`/`status` + Traces.

### File List

- `src/agent/tools/record-client-data.ts` (novo) — tool de coleta (valida e-mail, gate, transição p/ scheduling)
- `src/agent/pre-atendimento.ts` (modificado) — instruções de coleta + registro da tool
- `src/repos/conversation-repo.ts` (modificado) — `updateCollected` (merge parcial) + `findById`
- `src/agent/tools/record-demand-type.ts` (modificado) — não-regressão do status (fix)
- `src/types.ts` (modificado) — alias `Collected`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificado) — status da story 1.6
- `_bmad-output/implementation-artifacts/1-6-coleta-conversacional-de-dados-do-cliente.md` (modificado) — frontmatter, checkboxes, Dev Agent Record, status

## Change Log

| Data       | Versão | Descrição                                                                                  | Autor        |
|------------|--------|--------------------------------------------------------------------------------------------|--------------|
| 2026-06-09 | 0.1    | Coleta conversacional (recordClientData): nome/e-mail/resumo/horário com merge parcial, validação de e-mail e gate p/ scheduling; fix de não-regressão de status | Amelia (dev) |
