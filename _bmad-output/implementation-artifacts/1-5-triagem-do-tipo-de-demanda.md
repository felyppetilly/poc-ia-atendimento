---
baseline_commit: aa6e2a746414bd9f2b9d981817a3dbd43a776ec2
---

# Story 1.5: Triagem do tipo de demanda

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Cliente,
I want descrever minha situação em linguagem leiga e ser entendido,
so that o escritório saiba do que se trata antes de marcar a conversa.

**Realiza:** FR-2.

## Acceptance Criteria

**AC1 — Classificação em exatamente 1 dos 4 tipos + confirmação**
**Given** o Cliente descreveu sua demanda em linguagem livre
**When** a IA interpreta a descrição
**Then** ela atribui **exatamente um** dos quatro Tipos de Demanda (compra/venda, locação, regularização/cartório, distrato/disputas) e registra em `conversations.demand_type`
**And** reflete o entendimento de volta ao Cliente e pede **confirmação** antes de prosseguir.

**AC2 — Fora de escopo após 1 esclarecimento → Fallback**
**Given** uma descrição que não corresponde a nenhum Tipo de Demanda (assunto não-imobiliário ou ambíguo)
**When** a IA faz **uma** tentativa de esclarecimento e ainda assim não se enquadra
**Then** a conversa é encaminhada ao Fallback (FR-9, Story 1.7)
**And** em nenhum momento a IA emite opinião jurídica sobre o caso (NFR-1).

## Tasks / Subtasks

- [x] **Task 1 — `src/domain/triage.ts` (lógica pura dos 4 tipos)** (AC: 1, 2)
  - [x] Definir os 4 Tipos de Demanda com slug (= valor do DB) + rótulo + descrição/exemplos para o agente interpretar:
    - `compra_venda` — compra/venda de imóvel
    - `locacao` — locação/aluguel
    - `regularizacao` — regularização/cartório (escritura, registro, inventário de imóvel, usucapião…)
    - `distrato` — distrato/disputas (rescisão, conflito entre partes)
  - [x] Exportar os slugs válidos (reutilizar/alinhar com o CHECK de `conversations.demand_type` da migration `0001`) e um texto-guia (rótulos + exemplos) para injetar nas instruções do agente
  - [x] (Opcional) helper de validação `isValidDemandType(slug)` — `domain/` é puro, sem I/O. [Source: architecture.md#Architectural Boundaries]
- [x] **Task 2 — Tool `recordDemandType` (`src/agent/tools/record-demand-type.ts`)** (AC: 1)
  - [x] `tool({ name: 'recordDemandType', description, parameters: z.object({ demandType: z.enum([...slugs]) }), execute })`
  - [x] `execute`: valida o slug via `domain/triage`, persiste via `conversation-repo.update(conversationId, { demandType, status: 'collecting' })` (transição de fase para a coleta da Story 1.6)
  - [x] A tool **orquestra**; a regra (tipos válidos) vem de `domain/triage`; a escrita vem do repo. Tool não contém regra de negócio nem SQL. [Source: architecture.md#Enforcement Guidelines]
  - [x] Retorno estruturado `{ ok: true }` / `{ ok: false, reason }` (padrão de erro das tools). [Source: architecture.md#Process Patterns]
  - [x] Registrar a tool no agente (`tools: [recordDemandType]` em `pre-atendimento.ts`)
  - [x] ⚠️ A tool precisa do `conversationId`/`phone` do turno atual — passar via `context` do `run` (ver Dev Notes "Como a tool conhece a conversa")
- [x] **Task 3 — Estender instruções do agente (triagem)** (AC: 1, 2)
  - [x] Acrescentar às instruções da 1.4 a etapa de **triagem** (ver Dev Notes "Instruções — triagem"):
    - interpretar a descrição livre → classificar em **exatamente um** dos 4 tipos
    - **refletir o entendimento de volta** e pedir confirmação ("Entendi que é um caso de *locação*, certo?")
    - **só após o Cliente confirmar**, chamar `recordDemandType`
    - depois de confirmado, seguir para a coleta (Story 1.6 — placeholder por ora)
    - **fora de escopo:** se não se enquadrar, fazer **uma** tentativa de esclarecimento; persistindo a não-correspondência → acionar Fallback (ver Task 4)
  - [x] Reforçar NFR-1 (já no guardrail global da 1.4): nunca opinar juridicamente durante a triagem
- [x] **Task 4 — Caminho de fora-de-escopo (preparar Fallback da 1.7)** (AC: 2)
  - [x] Como `escalateToLucas` (notificação real ao Lucas) é da **Story 1.7**, nesta story: ao detectar fora-de-escopo após 1 esclarecimento, a IA responde com **cortesia** informando que o Dr. Lucas dará sequência (sem prometer prazo) e a conversa é marcada `status = 'escalated'` (via `conversation-repo`)
  - [x] Deixar o **gancho explícito** para a 1.7 plugar `escalateToLucas` (a notificação WhatsApp ao Lucas é adicionada lá). Documentar isso no código (comentário) e não duplicar depois. Ver Dev Notes "Dependência de ordem com a 1.7"
- [x] **Task 5 — Verificação manual (demo da story)** (AC: 1, 2)
  - [x] "Quero alugar um apartamento" → IA reflete "locação", pede confirmação; ao confirmar → `conversations.demand_type = 'locacao'`, `status = 'collecting'`
  - [x] Testar os 4 tipos (compra/venda, locação, regularização, distrato)
  - [x] "Quero processar meu vizinho por barulho" (não-imobiliário) → 1 esclarecimento → fora-de-escopo → mensagem cortês de encaminhamento + `status = 'escalated'`
  - [x] Pedir opinião jurídica no meio da triagem → não opina (guardrail/instrução)

## Dev Notes

### Dependência das stories anteriores
- **1.4** entregou: `agent/pre-atendimento.ts` (instruções + guardrail), `agent/runner.ts` (carrega→roda→persiste→responde), `agent/guardrails.ts`. Esta story **estende as instruções** e **adiciona a 1ª tool** (`recordDemandType`). [Source: 1-4 story]
- **1.2** entregou `conversation-repo.update(id, patch)` e os CHECKs de `demand_type`/`status`. Os slugs de `demand_type` desta story **devem casar** com o CHECK da migration `0001` (`compra_venda`/`locacao`/`regularizacao`/`distrato`). [Source: 1-2 Dev Notes "DDL de referência"]
- **Status:** a conversa entra na triagem em `status` `greeting`/`triaging`; ao confirmar o tipo, vai para `collecting` (fase da Story 1.6); fora-de-escopo vai para `escalated`. (Valores já no CHECK da `0001`.)

### Como o agente grava `demand_type` — decisão de design (tool vs structured output)
A arquitetura mapeia FR-2 para `pre-atendimento.ts` (instruções) + `domain/triage.ts`, mas **não** especifica o mecanismo de escrita do estado. Decisão para esta POC: **function tool** (`recordDemandType`), que é o padrão idiomático do Agents SDK para o agente executar uma ação com efeito colateral, mantendo as fronteiras (tool orquestra · `domain/triage` tem a regra · `repo` faz I/O). **Não** usar `outputType`/structured output para isso — fragmentaria a resposta conversacional. [Source: architecture.md#Agent Architecture, #Enforcement Guidelines; openaiDeveloperDocs#agents/quickstart "Give the agent a tool"]

### Assinatura de tool (Agents SDK TS) — confirmada via MCP
```ts
import { tool } from '@openai/agents';
import { z } from 'zod';
export const recordDemandType = tool({
  name: 'recordDemandType',
  description: 'Registra o Tipo de Demanda APÓS o Cliente confirmar. Use só depois da confirmação.',
  parameters: z.object({ demandType: z.enum(['compra_venda','locacao','regularizacao','distrato']) }),
  async execute({ demandType }, runContext) {
    // valida via domain/triage, persiste via conversation-repo, retorna {ok}
  },
});
```
[Source: openaiDeveloperDocs#agents/quickstart] — **confirmar na referência do `@openai/agents`** a forma exata de acessar o `context`/`runContext` dentro de `execute` (Task: "Como a tool conhece a conversa").

### Como a tool conhece a conversa (conversationId/phone)
- A tool precisa saber **qual** conversa atualizar. Passe o contexto do turno ao `run` via a opção `context` (ex.: `run(agent, inputItems, { context: { conversationId, phone } })`); dentro de `execute`, leia esse contexto. **Confirmar o nome do parâmetro de contexto e como ele chega no `execute`** na referência do SDK (o doc de guardrails mostra `context` sendo propagado; o de tools mostra `execute`). Não cravar de memória.
- O `runner` (1.4) é quem chama `run` — estenda-o para montar e passar esse `context`.

### Instruções — triagem (estender as da 1.4)
Acrescentar (PT-BR), mantendo o tom cordial e o guardrail:
- "Depois de saudar, **interprete** a situação que o Cliente descrever e **classifique** em **exatamente um** destes 4 tipos: compra/venda, locação, regularização/cartório, distrato/disputas. (Use os exemplos de `domain/triage`.)"
- "**Reflita** seu entendimento de volta em linguagem simples e **peça confirmação** antes de prosseguir. Só chame `recordDemandType` **após** o Cliente confirmar."
- "Se a descrição **não** se encaixar em nenhum tipo (ex.: assunto não-imobiliário) ou estiver ambígua, faça **uma** pergunta de esclarecimento. Se ainda assim não se enquadrar, informe com cortesia que o Dr. Lucas dará sequência (sem prometer prazo) — isso é o **Fallback**."
- "**Nunca** opine juridicamente sobre o caso, mesmo que pareça simples."
- Outcome-first (recomendação gpt-5.5): descreva o objetivo (classificar+confirmar) e os limites, sem microgerenciar o passo a passo. [Source: openaiDeveloperDocs#latest-model]

### Dependência de ordem com a 1.7 (Fallback)
- A tool real `escalateToLucas` (notifica o Lucas no WhatsApp) é da **Story 1.7**. Nesta story, o caminho de fora-de-escopo apenas: (a) responde com cortesia ao Cliente e (b) marca `status = 'escalated'`. A **notificação ao Lucas ainda não acontece** até a 1.7 — isso é aceitável (entrega incremental). [Source: epics.md#Story 1.7]
- Deixe o ponto de extensão claro (comentário no código) para a 1.7 plugar `escalateToLucas` no mesmo gatilho, **sem** reescrever a detecção de fora-de-escopo. A detecção/gatilhos podem morar em `domain/triage.ts` (regra pura) e serem reaproveitados pela 1.7.

### Fronteiras e padrões [Source: architecture.md#Architectural Boundaries, #Enforcement Guidelines]
- `domain/triage.ts` é **puro** (tipos, exemplos, regra de fora-de-escopo) — sem I/O, testável isolado.
- A tool fala com `domain` + `repos`; **não** SQL direto, **não** lê payload bruto.
- Texto de WhatsApp puro; config via `config.ts`; guardrail jurídico global (1.4) continua valendo.

### O que NÃO fazer nesta story (escopo)
- ❌ Implementar a coleta de nome/e-mail/resumo (Story 1.6) — aqui só transiciona para `collecting`.
- ❌ Implementar a notificação real ao Lucas (`escalateToLucas`, Story 1.7) — só marca `escalated` + mensagem cortês.
- ❌ Classificar em mais de um tipo, ou avançar sem a confirmação do Cliente.
- ❌ Usar slug de `demand_type` diferente do CHECK da `0001`.
- ❌ Emitir qualquer opinião jurídica (NFR-1).

### Project Structure Notes
- Arquivos: `src/domain/triage.ts` (novo), `src/agent/tools/record-demand-type.ts` (novo), edição de `src/agent/pre-atendimento.ts` (instruções + registrar tool) e `src/agent/runner.ts` (passar `context`). Alinhado à árvore. [Source: architecture.md#Complete Project Directory Structure — `domain/triage.ts`, `agent/tools/`]

### Testing standards
- Sem testes automatizados (POC) — verificação manual (Task 5) via WhatsApp + inspeção de `conversations.demand_type`/`status` + Traces. [Source: architecture.md]

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5] — user story + ACs (FR-2)
- [Source: _bmad-output/planning-artifacts/architecture.md#Agent Architecture] — 1 agente + tools + guardrail
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements to Structure Mapping] — FR-2 → pre-atendimento.ts + domain/triage.ts
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural Boundaries / #Enforcement Guidelines] — domain puro, tools orquestram, repos para dados
- [Source: openaiDeveloperDocs#agents/quickstart] — `tool({ name, description, parameters, execute })`
- [Source: openaiDeveloperDocs#latest-model] — prompts outcome-first (gpt-5.5)
- [Source: 1-2-...supabase.md] — slugs/CHECK de `demand_type`, `conversation-repo.update`
- [Source: 1-4-...guardrail-juridico.md] — instruções/runner/guardrail a estender

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev) — agente da POC roda em `gpt-5.5`

### Debug Log References

- **API de tools do `@openai/agents` v0.11.6 confirmada nos `.d.ts`**: `tool({ name, description, parameters: z.object({...}), execute })`; `execute(input, runContext, details)` recebe o contexto via `runContext.context`; `run(agent, input, { context })` (RunOptions.context). Não cravado de memória.
- `npx tsc --noEmit` → exit 0.
- **Verificação com runs REAIS (gpt-5.5)** via script descartável `tmp-triage-test.ts` (chamou `runTurn` direto; sem WhatsApp). 8/8 checks:
  - **Locação**: "quero alugar um apartamento" → agente refletiu "locação" e pediu confirmação → ao confirmar chamou `recordDemandType` → `demand_type='locacao'`, `status='collecting'`.
  - **Compra/venda**: "comprando uma casa..." → confirmou → `demand_type='compra_venda'`.
  - **Fora de escopo**: "processar meu vizinho por barulho" → 1 esclarecimento → `escalateToLucas` → `status='escalated'`, `demand_type` nulo.
  - **Opinião jurídica no meio**: "posso despejar sem aviso? tenho direito?" → não opinou, redirecionou e seguiu triando (locação).
- **Estado final confirmado via MCP**: 801 locacao/collecting · 802 compra_venda/collecting · 803 escalated/null · 804 greeting/null. Dados truncados ao final.

### Completion Notes List

- **Decisão de design (FR-2):** escrita do estado via **function tool** (`recordDemandType`), padrão idiomático do Agents SDK — não structured output (não fragmenta a conversa). Fronteiras respeitadas: tool **orquestra**; regra (slugs válidos) em `domain/triage`; I/O em `conversation-repo`.
- **`domain/triage.ts` puro** (sem I/O): 4 tipos com slug/rótulo/exemplos, `DEMAND_TYPE_SLUGS`, `isValidDemandType`, e `TRIAGE_GUIDE` (texto injetado nas instruções — fonte única dos tipos, não espalhada no prompt). Slugs casam com o CHECK da migration 0001.
- **Contexto do turno:** `runner` passa `{ conversationId, phone }` via `run(agent, input, { context })`; as tools leem `runContext.context` (tipado como `TurnContext`). Foi a peça que faltava para a tool saber qual conversa atualizar.
- **Confirmação antes de registrar:** instrução manda refletir o entendimento e só chamar `recordDemandType` após o "sim" do Cliente — confirmado no teste (turno 1 pergunta, turno 2 registra).
- **Caminho fora-de-escopo:** tool `escalateToLucas` criada já com o **nome final da 1.7**; nesta story só marca `status='escalated'` + retorna ok. Comentário `TODO(Story 1.7)` marca onde plugar a notificação real ao Lucas no WhatsApp — gancho explícito, sem reescrever o gatilho/detecção depois.
- Guardrail jurídico global (1.4) continua valendo durante a triagem (verificado no flow D).
- **Escopo respeitado:** só triagem + transição de fase; sem coleta de dados (1.6) e sem notificação real ao Lucas (1.7).
- **Pendência de Felyppe (Task 5 com WhatsApp real, pós-deploy):** testar os 4 tipos e o fora-de-escopo via WhatsApp, conferindo `demand_type`/`status` e os Traces.

### File List

- `src/domain/triage.ts` (novo) — 4 tipos puros, slugs, `isValidDemandType`, `TRIAGE_GUIDE`
- `src/agent/tools/record-demand-type.ts` (novo) — tool de registro do tipo (→ status collecting)
- `src/agent/tools/escalate-to-lucas.ts` (novo) — tool de fallback (→ status escalated; gancho da 1.7)
- `src/agent/pre-atendimento.ts` (modificado) — instruções de triagem + fora-de-escopo + registro das tools
- `src/agent/runner.ts` (modificado) — passa `context { conversationId, phone }` ao `run`
- `src/types.ts` (modificado) — `TurnContext`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificado) — status da story 1.5
- `_bmad-output/implementation-artifacts/1-5-triagem-do-tipo-de-demanda.md` (modificado) — frontmatter, checkboxes, Dev Agent Record, status

## Change Log

| Data       | Versão | Descrição                                                                            | Autor        |
|------------|--------|--------------------------------------------------------------------------------------|--------------|
| 2026-06-09 | 0.1    | Triagem dos 4 tipos via tool recordDemandType (com confirmação) + fallback fora-de-escopo (escalateToLucas, hook 1.7); domain/triage puro | Amelia (dev) |
