---
baseline_commit: aa6e2a746414bd9f2b9d981817a3dbd43a776ec2
---

# Story 1.4: Saudação e abertura pelo agente com guardrail jurídico

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Cliente que faz o primeiro contato,
I want ser saudado de forma natural por um assistente que se identifica claramente,
so that eu saiba com quem estou falando e me sinta à vontade para explicar minha demanda.

**Realiza:** FR-1, NFR-1.

## Acceptance Criteria

**AC1 — Runner do agente substitui o placeholder da 1.3**
**Given** o agente "Pré-atendimento" (OpenAI Agents SDK) com `runner` que **carrega estado → roda o agente → persiste → responde**
**When** uma mensagem é processada
**Then** o `runner` substitui a resposta placeholder da Story 1.3 como gerador da resposta dentro de `processTurn`.

**AC2 — Saudação e identificação (FR-1, NFR-3)**
**Given** o agente em operação
**When** um número desconhecido envia a primeira mensagem
**Then** a IA responde com uma saudação que se identifica como **assistente automatizado** do **"Escritório do Lucas"** e pergunta no que pode ajudar
**And** a saudação é cordial e simples, deixa claro que é atendimento automatizado e **não** se passa por humano nem por advogado
**And** a IA responde **24/7** (NFR-3).

**AC3 — Guardrail jurídico em todos os turnos (NFR-1) + tracing**
**Given** o guardrail jurídico de saída ativo em **todos os turnos**
**When** o Cliente, em qualquer momento, pede orientação/opinião jurídica
**Then** a IA **nunca** emite orientação, opinião ou interpretação jurídica
**And** redireciona com cortesia para o agendamento ou para o Fallback
**And** o **tracing** do Agents SDK está habilitado para depurar a demo.

## Tasks / Subtasks

- [x] **Task 1 — Promover `OPENAI_API_KEY` no `config.ts`** (AC: 1)
  - [x] Promover de `.optional()` para **required** no schema zod (esta story passa a consumir a OpenAI — contrato de "config incremental")
  - [x] Confirmar que consta no `.env.example`
  - [x] (Opcional) adicionar `OPENAI_MODEL` no config com default `gpt-5.5`, para não cravar o slug no código
- [x] **Task 2 — `src/agent/pre-atendimento.ts` (definição do agente)** (AC: 2, 3)
  - [x] `new Agent({ name: 'Pré-atendimento', instructions, model: config.openaiModel, outputGuardrails: [legalGuardrail] })`
  - [x] **Instruções** (system) — ver Dev Notes "Instruções do agente (1.4)". Foco desta story: identidade + saudação + guardrail jurídico. As instruções **vão crescer** nas stories 1.5/1.6/2.x (triagem, coleta, agendamento) — estruturar o texto para ser estendido.
  - [x] Modelo: `gpt-5.5` (confirmado como atual via MCP). Customer-facing → instruir **tom cordial/caloroso** explicitamente (mudança de comportamento documentada do gpt-5.5: default é mais direto/seco)
  - [x] (Opcional) `modelSettings` com `verbosity: 'low'` e `reasoning effort: 'low'` para respostas curtas/baratas (saudação/triagem são leves) — **confirmar os nomes exatos dos campos de `modelSettings` na referência do `@openai/agents`** antes de cravar
- [x] **Task 3 — `src/agent/guardrails.ts` (guardrail jurídico de saída — NFR-1)** (AC: 3)
  - [x] Output guardrail que detecta se a resposta contém orientação/opinião/interpretação jurídica e, se sim, dispara o tripwire (`tripwireTriggered: true`)
  - [x] Defesa em profundidade: a **1ª linha** é a própria instrução de sistema (o agente já não dá conselho jurídico); o guardrail é **backstop**. Manter barato (ver Dev Notes "Guardrail: custo/latência")
  - [x] Confirmar a assinatura exata de `outputGuardrails` + o nome do erro de tripwire (`OutputGuardrailTripwireTriggered`) na referência do SDK
- [x] **Task 4 — `src/agent/runner.ts` (carrega → roda → persiste → responde)** (AC: 1, 2, 3)
  - [x] `runTurn(phone, inboundText): Promise<string>`:
    1. carregar estado: `conversation-repo.findByPhoneWithMessages(phone)` (a mensagem do Cliente já foi persistida em `processTurn` — ver nota de ordem em Dev Notes)
    2. montar o **histórico** como array de input items `{ role, content }` a partir das `messages` recentes (ordem cronológica) — ver Dev Notes "Estado multi-turno"
    3. `const result = await run(agent, inputItems)` → `const reply = result.finalOutput`
    4. **tratar tripwire do guardrail** (try/catch em `OutputGuardrailTripwireTriggered`) → substituir por mensagem segura de redirecionamento (agendamento/fallback)
    5. retornar `reply` (a persistência da resposta `assistant` e o envio ficam em `processTurn`, como na 1.3)
  - [x] Sem mudar o estado (`status`) ainda — as transições de fase entram nas stories de triagem/coleta. Aqui só garantir saudação + guardrail.
- [x] **Task 5 — Ligar o runner em `processTurn` (substituir placeholder da 1.3)** (AC: 1)
  - [x] Trocar `generateReply()` placeholder por `await runTurn(phone, text)`
  - [x] Manter o fluxo da 1.3: persistir `user` (antes) → `runTurn` → `evolutionClient.sendText` → persistir `assistant`
  - [x] try/catch: se o agente/OpenAI falhar, responder com cortesia ao Cliente (sem vazar erro técnico) — padrão de erro da arquitetura
- [x] **Task 6 — Tracing** (AC: 3)
  - [x] O tracing do Agents SDK é **automático no caminho server-side** (basta `OPENAI_API_KEY`). **Não** desabilitar. Verificar os traces em `platform.openai.com/traces`
  - [x] (Opcional) nomear o workflow/trace (ex.: "pre-atendimento") para facilitar a depuração
- [x] **Task 7 — Verificação manual (demo da story)** (AC: 2, 3)
  - [x] Enviar "oi" de um número novo → recebe saudação que se identifica como assistente automatizado do "Escritório do Lucas" e pergunta como ajudar (cordial, claramente automatizado, não se passa por humano/advogado)
  - [x] Pedir explicitamente conselho jurídico (ex.: "posso despejar meu inquilino sem aviso?") → a IA **não** opina e redireciona para agendar/fallback
  - [x] Confirmar o turno no dashboard de **Traces**
  - [x] Confirmar persistência: `messages` com os turnos (user/assistant)

## Dev Notes

### Dependência das stories anteriores
- **1.1/1.2/1.3** concluídas: `config.ts` (config incremental), repos (`findByPhoneWithMessages`, `message-repo.add`), `webhook/handler` + `queue`, `evolution-client`, `processTurn` com **resposta placeholder isolada** numa função `generateReply()`. Esta story **troca esse placeholder** pelo `runner`. [Source: 1-3 Dev Notes "Onde a Story 1.4 entra"]
- `@openai/agents` e `openai` **já foram instalados** na 1.1 — não reinstalar. `zod` também já está. [Source: 1-1]
- **Config incremental:** promover `OPENAI_API_KEY` a required agora; Graph segue opcional até a Story 2.1.

### Modelo OpenAI — confirmado via MCP (06/2026)
- **Modelo atual: `gpt-5.5`** (decisão que a arquitetura deixou para "confirmar via MCP na hora de codar" — agora resolvida). [Source: openaiDeveloperDocs#latest-model]
- Características relevantes: Responses API (o Agents SDK usa por baixo), tool-calling forte (importante p/ as tools do Épico 2), default `reasoning.effort = medium`.
- **Customer-facing (importante):** o gpt-5.5 por padrão é mais **direto/conciso/seco**; para a experiência de WhatsApp, **instrua explicitamente** personalidade, calor e cordialidade nas instruções, senão soa robótico. [Source: openaiDeveloperDocs#latest-model "Default style is more concise and direct"]
- **Custo/latência (POC ~5 contatos/dia):** saudação/triagem são leves → considerar `reasoning.effort: 'low'` e `text.verbosity: 'low'` para respostas curtas e baratas. Ajustar via `modelSettings` do Agent — **confirmar os nomes dos campos** na referência do `@openai/agents` (não cravar de memória).
- **Não** colocar a data atual nas instruções (o modelo já sabe a data UTC). Contexto de timezone `America/Sao_Paulo` só entra onde for relevante para agendamento (Épico 2). [Source: openaiDeveloperDocs#latest-model "Current date"]

### API do Agents SDK (TypeScript) — confirmada via MCP
```ts
import { Agent, run } from '@openai/agents';
// definição
const agent = new Agent({ name: 'Pré-atendimento', instructions: '...', model: 'gpt-5.5', outputGuardrails: [/*...*/] });
// execução (1 run = 1 turno da aplicação)
const result = await run(agent, inputItems);  // inputItems: string | array de itens {role, content}
const reply = result.finalOutput;
```
[Source: openaiDeveloperDocs#agents/quickstart, #agents/running-agents]

### Estado multi-turno — estratégia "histórico na aplicação" [Source: openaiDeveloperDocs#agents/running-agents "Choose one conversation strategy"]
- O SDK oferece 4 estratégias (histórico local na app · `session` · `conversationId` · `previous_response_id`). **Nossa arquitetura usa a 1ª: o histórico vive na nossa aplicação (Supabase)** — carregamos as `messages` recentes por `phone` a cada webhook e passamos ao `run`. **Não** usar `MemorySession`/`conversationId` (cada webhook é um processo stateless; a fonte da verdade é o nosso DB). [Source: architecture.md#Data Architecture "a cada webhook entrante, carrega conversations + messages recentes pelo phone, roda o agente"]
- **Montagem do input:** transformar as `messages` (ordem cronológica) em array de itens `{ role: 'user'|'assistant', content }`. Esse array, terminando na última mensagem do Cliente, é o `input` do `run`. **Confirmar o tipo exato do item (`AgentInputItem`) na referência do SDK** — a forma `{role, content}` é a esperada pela Responses API.
- **Ordem (evitar duplicar a última mensagem):** `processTurn` já persiste a mensagem `user` recebida **antes** de chamar o runner (fluxo herdado da 1.3). Logo, `findByPhoneWithMessages` já retorna o histórico **incluindo** a mensagem atual como último item `user`. Passe esse histórico direto ao `run` — **não** reanexar `inboundText` por cima (senão duplica). _(Alternativa equivalente: persistir o `user` só depois e anexar `inboundText` ao histórico carregado — escolha uma e seja consistente.)_

### Instruções do agente (1.4) — escopo desta story
Conteúdo mínimo (em PT-BR), pensado para **crescer** nas próximas stories:
- **Identidade:** "Você é o assistente **automatizado** do Escritório do Lucas (advogado imobiliário). Você NÃO é humano e NÃO é advogado — deixe isso claro com naturalidade quando fizer sentido."
- **Saudação (primeiro contato):** cumprimentar de forma cordial e simples, identificar-se como assistente automatizado do "Escritório do Lucas" e perguntar no que pode ajudar.
- **Guardrail jurídico (NFR-1, crítico):** "**NUNCA** dê orientação, opinião ou interpretação jurídica sobre o caso do Cliente. Se pedirem conselho jurídico, **redirecione com cortesia** para agendar uma conversa com o Dr. Lucas ou para o encaminhamento, sem opinar."
- **Tom:** cordial, acolhedor, frases curtas, texto puro para WhatsApp (sem markdown pesado). [Source: architecture.md#Format Patterns]
- **Escopo:** o objetivo é triar e agendar (detalhado nas próximas stories). Por ora, após saudar, convidar o Cliente a descrever a situação.
- **Placeholders de config:** referenciar nome do escritório/identidade como texto fixo aqui; dados de negócio dinâmicos (endereço, número do Lucas) entram nas tools/stories que os usam.

### Guardrail jurídico: custo/latência e implementação [Source: openaiDeveloperDocs#agents/guardrails-approvals; architecture.md#Agent Architecture]
- **Output guardrails** validam a resposta final antes de sair; rodam só no agente que produz o output final. Disparam um tripwire que lança erro (`OutputGuardrailTripwireTriggered`), que o `runner` captura.
- Forma (espelha o exemplo de input guardrail do doc; **confirmar `outputGuardrails` na ref do SDK**):
```ts
// src/agent/guardrails.ts (esboço — validar assinatura na ref)
export const legalGuardrail = {
  name: 'guardrail-juridico',
  async execute({ agentOutput /* texto final */, context }) {
    const violou = /* classifica se há conselho/opinião jurídica */;
    return { outputInfo: { violou }, tripwireTriggered: violou };
  },
};
```
- **Cuidado com custo/latência:** um guardrail baseado em LLM roda a **cada turno** (na POC, ~ok; mas evite reasoning alto). Opções: (a) guardrail-agent pequeno com `reasoning.effort:'low'`; (b) heurística leve + a instrução de sistema como defesa principal. Para a POC, a **instrução de sistema é a defesa primária**; mantenha o guardrail simples. [Source: architecture.md "guardrail de saída + instrução de sistema"]
- **Ao disparar:** o `runner` substitui o output bloqueado por uma resposta segura de redirecionamento ("não posso dar orientação jurídica, mas posso agendar uma conversa com o Dr. Lucas…") e segue o fluxo normal de persistir/enviar.

### Tracing [Source: openaiDeveloperDocs#agents/quickstart "Inspect traces early"]
- O caminho server-side do SDK **já inclui tracing** — não precisa configurar nada além de `OPENAI_API_KEY`. Ver em `platform.openai.com/traces` (model calls, tool calls, handoffs, guardrails). **Não desabilitar** (a AC exige tracing ativo). Opcional: nomear o trace/workflow.

### Fronteiras e padrões [Source: architecture.md#Enforcement Guidelines]
- Lógica do agente vive em `agent/`; o agente **não** fala direto com banco/Evolution — quem orquestra persistência/envio é `processTurn` (e, nas próximas stories, as tools). Nesta story não há tools ainda.
- Config só via `config.ts`. Texto de WhatsApp puro. Erros nunca vazam stack ao Cliente.

### O que NÃO fazer nesta story (escopo)
- ❌ Implementar triagem dos 4 tipos (Story 1.5), coleta de dados (1.6), fallback/tool `escalateToLucas` (1.7) ou qualquer tool de agenda (Épico 2). Aqui é **só** saudação + identidade + guardrail jurídico + o runner que troca o placeholder.
- ❌ Usar `MemorySession`/`conversationId`/`previous_response_id` — o estado é o nosso Supabase.
- ❌ Cravar assinaturas de `outputGuardrails`/`modelSettings`/`AgentInputItem` sem conferir na referência do `@openai/agents`.
- ❌ Deixar o tom seco/robótico (gpt-5.5 default) — instruir calor/cordialidade.
- ❌ Re-anexar a mensagem do Cliente ao histórico se ela já foi persistida (duplicação).

### Project Structure Notes
- Arquivos: `src/agent/pre-atendimento.ts`, `src/agent/guardrails.ts`, `src/agent/runner.ts`; edição de `src/webhook/handler.ts` (ou onde vive `processTurn`) e `src/config.ts`. Alinhado à árvore da arquitetura. [Source: architecture.md#Complete Project Directory Structure]

### Testing standards
- Sem testes automatizados (POC) — verificação manual (Task 7) via WhatsApp + dashboard de Traces + inspeção do banco. [Source: architecture.md]

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4] — user story + ACs (FR-1, NFR-1)
- [Source: _bmad-output/planning-artifacts/architecture.md#Agent Architecture] — 1 agente, guardrail de saída + instrução, tracing
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — estado por phone carregado a cada turno (histórico na app)
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns / #Enforcement Guidelines] — texto puro, fronteiras
- [Source: openaiDeveloperDocs#agents/quickstart] — `new Agent`, `run`, `finalOutput`, tracing automático
- [Source: openaiDeveloperDocs#agents/running-agents] — estratégias de estado (histórico na app), agent loop
- [Source: openaiDeveloperDocs#agents/guardrails-approvals] — input/output guardrails, tripwire, boundaries
- [Source: openaiDeveloperDocs#latest-model] — `gpt-5.5` atual, customer-facing precisa de warmth explícito, verbosity/effort
- [Source: 1-3-...round-trip.md] — placeholder a ser substituído, fluxo de processTurn

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev) — agente da POC roda em `gpt-5.5` (confirmado em runtime)

### Debug Log References

- **API do `@openai/agents` v0.11.6 confirmada nos próprios `.d.ts` instalados** (não de memória): `OutputGuardrail = { name, execute }`; `execute(args)` recebe `{ agent, agentOutput, context, details? }` e retorna `{ tripwireTriggered, outputInfo }`; erro `OutputGuardrailTripwireTriggered`; `run(agent, input)` → `result.finalOutput`; `modelSettings.reasoning.effort` + `modelSettings.text.verbosity`; `AgentInputItem` (user aceita `content` string; **assistant exige** `status:'completed'` + `content:[{type:'output_text',text}]`); `withTrace(name, fn)` para nomear o workflow.
- `npx tsc --noEmit` → exit 0.
- **Verificação com run REAL (gpt-5.5)** via script descartável `tmp-agent-test.ts` (chamou `runTurn` direto, sem enviar WhatsApp). 7/7 checks:
  - Turno 1 "oi" → "Oi! Tudo bem? 😊 Sou o assistente automatizado do Escritório do Lucas, advocacia imobiliária. Como posso te ajudar..." (cordial, automatizado, não-advogado). ✅ AC2
  - Turno 2 "posso despejar meu inquilino sem aviso? tenho esse direito?" → "...não consigo dar orientação jurídica nem dizer se você tem esse direito... posso te ajudar a agendar uma conversa com ele..." (não opina, redireciona). ✅ AC3
  - Guardrail unit: dispara tripwire em "Sim, você pode despejar..., é legal"; NÃO dispara em saudação. ✅
- **Persistência multi-turno confirmada via MCP**: 4 mensagens (u/a/u/a) na ordem certa para o phone de teste. Dados truncados ao final.
- Tracing: ativo automaticamente (server-side); workflow nomeado `pre-atendimento` via `withTrace`. Conferir em platform.openai.com/traces.

### Completion Notes List

- **Runner substituiu o placeholder da 1.3** dentro de `processTurn`: `getOrCreateByPhone` → persiste `user` → `runTurn(phone, text)` → `sendText` → persiste `assistant`. Mantido o fluxo/ordem da 1.3.
- **Estado multi-turno = histórico na aplicação (Supabase)**, conforme arquitetura: `findByPhoneWithMessages` carrega o histórico (que já inclui a mensagem atual do Cliente, persistida antes) e monta `AgentInputItem[]`; **não** reanexa o inboundText (evita duplicação). Sem `MemorySession`/`conversationId`.
- **Guardrail jurídico (NFR-1)** em duas camadas: instrução de sistema (defesa primária) + `legalGuardrail` heurístico barato (backstop, sem LLM extra por turno). Ao disparar, `runTurn` captura `OutputGuardrailTripwireTriggered` e devolve um redirecionamento seguro. Heurística conservadora p/ evitar falso-positivo; fácil de trocar por classificador LLM depois.
- **Tom caloroso instruído explicitamente** (gpt-5.5 é seco por default) — confirmado na saída real.
- `OPENAI_API_KEY` promovida a required; `OPENAI_MODEL` adicionado (default `gpt-5.5`) para não cravar o slug no código.
- `modelSettings` com `reasoning.effort:'low'` + `text.verbosity:'low'` (saudação/triagem são leves → respostas curtas/baratas).
- Erro do agente/OpenAI é tratado em `processTurn` com fallback cordial (sem vazar stack ao Cliente). Fronteira respeitada: o agente não fala com banco/Evolution; quem orquestra é `processTurn`.
- **Escopo respeitado:** só saudação + identidade + guardrail. Sem triagem (1.5), coleta (1.6), fallback (1.7) ou tools de agenda (Épico 2).
- **Pendência de Felyppe (Task 7 com WhatsApp real, pós-deploy):** mandar "oi" de um número novo e pedir conselho jurídico, conferindo a resposta no WhatsApp e o turno no dashboard de Traces.

### File List

- `src/agent/guardrails.ts` (novo) — `legalGuardrail` (output guardrail heurístico)
- `src/agent/pre-atendimento.ts` (novo) — definição do `Agent` (instruções PT-BR, modelSettings, guardrail)
- `src/agent/runner.ts` (novo) — `runTurn` (carrega histórico → `run` → trata tripwire → texto)
- `src/webhook/process-turn.ts` (modificado) — usa `runTurn` no lugar do `generateReply` placeholder + fallback de erro
- `src/config.ts` (modificado) — `OPENAI_API_KEY` required + `OPENAI_MODEL` (default gpt-5.5)
- `.env.example` (modificado) — `OPENAI_MODEL`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificado) — status da story 1.4
- `_bmad-output/implementation-artifacts/1-4-saudacao-e-abertura-pelo-agente-com-guardrail-juridico.md` (modificado) — frontmatter, checkboxes, Dev Agent Record, status

## Change Log

| Data       | Versão | Descrição                                                                       | Autor        |
|------------|--------|---------------------------------------------------------------------------------|--------------|
| 2026-06-09 | 0.1    | Agente OpenAI (gpt-5.5): saudação/identidade + guardrail jurídico; runner substitui o placeholder; estado multi-turno via Supabase; tracing | Amelia (dev) |
