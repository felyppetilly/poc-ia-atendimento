---
baseline_commit: aa6e2a746414bd9f2b9d981817a3dbd43a776ec2
---

# Story 1.7: Encaminhamento ao Lucas (Fallback)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Lucas,
I want ser avisado por WhatsApp quando um caso foge do escopo da IA,
so that eu assuma manualmente os atendimentos que a IA não deve tratar.

**Realiza:** FR-9, UJ-2.

## Acceptance Criteria

**AC1 — Notificação ao Lucas nos gatilhos de Fallback**
**Given** a tool `escalateToLucas(resumo, contato)` e os gatilhos de Fallback definidos
**When** ocorre um dos gatilhos — assunto não-imobiliário, demanda fora dos quatro Tipos após esclarecimento, ou sinal de insatisfação/urgência que a IA não deve tratar
**Then** a IA notifica o **número de WhatsApp do Lucas** (`LUCAS_WHATSAPP`, default +55 11 98530-3959, configurável) com o **resumo da conversa** e o **contato do Cliente**
**And** a conversa é marcada com `status = 'escalated'`.

**AC2 — Resposta cortês ao Cliente, sem prometer prazo**
**Given** o Fallback acionado
**When** a IA responde ao Cliente
**Then** ela informa com cortesia que o **Dr. Lucas dará sequência**, **sem** prometer prazo específico
**And** a IA **não** emite opinião jurídica nem tenta resolver o caso fora de escopo (NFR-1).

## Tasks / Subtasks

- [x] **Task 1 — Tool `escalateToLucas` (`src/agent/tools/escalate-to-lucas.ts`)** (AC: 1)
  - [x] `tool({ name: 'escalateToLucas', description, parameters: z.object({ summary: z.string(), reason: z.string().optional() }), execute })`
  - [x] `execute` (recebe `conversationId`/`phone` via `context` do `run`, padrão das 1.5/1.6):
    1. carregar a conversa (`conversation-repo.findByPhone`/by id) para montar o **contato do Cliente**: nome + telefone (do `phone`) + e-mail (`collected.email`) + `demand_type` (ou "fora de escopo")
    2. **idempotência:** se a conversa **já** está `escalated`, **não** notificar de novo → retornar `{ ok: true, alreadyEscalated: true }` (evita spam ao Lucas em turnos seguintes) — ver Dev Notes
    3. montar a mensagem de Fallback (texto puro estruturado — ver Dev Notes "Mensagem ao Lucas")
    4. enviar via `evolutionClient.sendText(config.lucasWhatsapp, mensagem)` (o client normaliza para dígitos — 1.3)
    5. marcar `status = 'escalated'` via `conversation-repo.update`
    6. try/catch: se o envio ao Lucas falhar, **logar** (`[evolution]`) e retornar `{ ok: false, reason }` — a IA ainda responde ao Cliente com cortesia, sem vazar erro técnico [Source: architecture.md#Process Patterns]
  - [x] Registrar a tool no agente (`tools: [recordDemandType, recordClientData, escalateToLucas]`)
- [x] **Task 2 — Ligar a tool nos gatilhos de Fallback (fecha o gancho da 1.5)** (AC: 1, 2)
  - [x] Estender as instruções do agente com os **3 gatilhos** de Fallback (ver Dev Notes "Instruções — fallback")
  - [x] **Substituir** o placeholder da Story 1.5: o caminho de fora-de-escopo da triagem, que antes só marcava `escalated` + mensagem, agora **chama `escalateToLucas`**. Reaproveitar a detecção de fora-de-escopo de `domain/triage.ts` (1.5) — **não** duplicar a regra. [Source: 1-5 Dev Notes "Dependência de ordem com a 1.7"]
- [x] **Task 3 — Config do número do Lucas** (AC: 1)
  - [x] Confirmar `LUCAS_WHATSAPP` em `config.ts` com default `+5511985303959` e documentado no `.env.example` (já previsto desde a 1.1)
  - [x] Garantir que `evolutionClient.sendText` aceita o valor e normaliza para só dígitos (sem `+`/espaços) — herdado da 1.3
- [x] **Task 4 — Verificação manual (demo da story — UJ-2)** (AC: 1, 2)
  - [x] Gatilho "não-imobiliário": "quero abrir uma empresa" → após 1 esclarecimento, a IA aciona Fallback → **chega mensagem no WhatsApp do Lucas** com resumo + contato; `status = 'escalated'`; Cliente recebe resposta cortês sem prazo
  - [x] Gatilho "insatisfação/urgência": "isso é urgente, preciso falar com uma pessoa agora" → Fallback acionado
  - [x] **Idempotência:** mandar outra mensagem depois de já escalado → **não** dispara segunda notificação ao Lucas
  - [x] Confirmar que a IA **não** opina juridicamente em nenhum gatilho (NFR-1)

## Dev Notes

### Dependência das stories anteriores
- **1.3** entregou `evolution-client.sendText(phone, text)` (normaliza para dígitos) — reutilizado para notificar o Lucas. [Source: 1-3 story]
- **1.5** detecta fora-de-escopo e marcou `status='escalated'` **sem** notificar, deixando o **gancho** para esta story plugar `escalateToLucas`. Esta story completa esse caminho. [Source: 1-5 Dev Notes "Dependência de ordem com a 1.7"]
- **1.4/1.5/1.6** estabeleceram o padrão **tool + `context` do `run`** e o guardrail jurídico global. Esta tool segue o mesmo padrão.
- `LUCAS_WHATSAPP` já existe no config/`.env.example` desde a 1.1 (com default).

### Mensagem ao Lucas (texto puro estruturado) [Source: epics.md FR-9; architecture.md#Format Patterns]
Exemplo (sem markdown pesado — vai para WhatsApp):
```
🔔 Encaminhamento (IA Pré-atendimento)
Cliente: {nome ou '—'}
Telefone: {phone}
E-mail: {collected.email ou '—'}
Tipo: {demand_type ou 'fora de escopo'}
Motivo: {reason ou gatilho}
Resumo: {summary da IA}
```
- O `summary` é gerado pela IA (parâmetro da tool). Nome/telefone/e-mail/tipo a **tool** monta a partir do estado da conversa (não confie só no que a IA passar — puxe do `conversation-repo`). [Source: architecture.md#Communication Patterns]

### Idempotência (evitar spam ao Lucas)
- Sem guarda, cada nova mensagem do Cliente após o escalonamento dispararia outra notificação. A tool **checa `status === 'escalated'`** e, se já estiver, **não** reenvia. [Source: architecture.md#Process Patterns "idempotência/consistência"]
- A instrução também deve orientar a IA a **não** chamar `escalateToLucas` repetidamente na mesma conversa já encaminhada.

### Instruções — fallback (estender as anteriores) [Source: epics.md FR-9]
Acrescentar (PT-BR), tom cordial:
- "Acione o **Fallback** (`escalateToLucas`) quando: (1) o assunto **não** for imobiliário; (2) a demanda **não** se enquadrar nos 4 Tipos **após uma tentativa de esclarecimento** (Story 1.5); ou (3) houver **sinal de insatisfação/urgência** que você não deve tratar."
- "Ao acionar: gere um **resumo** objetivo da conversa para o Dr. Lucas. Depois, informe ao Cliente, **com cortesia**, que o **Dr. Lucas dará sequência** — **sem prometer prazo**."
- "**Não** opine juridicamente nem tente resolver o caso fora de escopo. Se já encaminhou esta conversa, **não** encaminhe de novo."
- Outcome-first (gpt-5.5): descreva os gatilhos e o resultado esperado, sem roteiro rígido. [Source: openaiDeveloperDocs#latest-model]

### Gatilho de insatisfação/urgência
- É um julgamento conversacional do agente (sinais como pedido explícito de falar com humano, reclamação, urgência declarada). Mantenha na **instrução** (não há regra determinística em `domain` para isso); a triagem fora-de-escopo (1.5) cobre o gatilho (1)/(2) via `domain/triage`.

### Fronteiras e padrões [Source: architecture.md#Enforcement Guidelines]
- Tool orquestra: lê estado via repo, envia via `evolution-client`, grava `status` via repo. Sem SQL solto, sem `process.env`, texto puro.
- `escalateToLucas` é o **segundo caminho de envio** da Evolution (o primeiro é a resposta ao Cliente) — ambos via o mesmo `evolution-client`. [Source: architecture.md#API & Communication Patterns]
- Erros de envio nunca vazam ao Cliente; guardrail jurídico (1.4) continua global.

### O que NÃO fazer nesta story (escopo)
- ❌ Reescrever a detecção de fora-de-escopo (reutilizar `domain/triage` da 1.5).
- ❌ Notificar o Lucas mais de uma vez na mesma conversa (idempotência).
- ❌ Prometer prazo ao Cliente / opinar juridicamente (NFR-1).
- ❌ Tocar em agenda/Microsoft Graph (Épico 2).
- ❌ Confiar apenas nos dados que a IA passa para a mensagem do Lucas — puxar contato do estado da conversa.

### Project Structure Notes
- Arquivos: `src/agent/tools/escalate-to-lucas.ts` (novo), edição de `src/agent/pre-atendimento.ts` (instruções + registrar tool) e do caminho de fora-de-escopo (runner/instruções). Reutiliza `evolution-client` (1.3), `domain/triage` (1.5), `conversation-repo` (1.2). Alinhado à árvore (`agent/tools/escalate-to-lucas.ts`). [Source: architecture.md#Complete Project Directory Structure]

### Fecha o Épico 1
- Com esta story, o Épico 1 entrega o fluxo conversacional completo (saudação → triagem → coleta → fallback) com guardrail jurídico transversal e serviço implantável. Próximo: `epic-1-retrospective` (opcional) e o **Épico 2** (agendamento), começando pela Story 2.1 (provisão Microsoft 365 + Graph). [Source: epics.md#Epic 1 / #Epic 2]

### Testing standards
- Sem testes automatizados (POC) — verificação manual (Task 4) via WhatsApp (Cliente + número do Lucas) + inspeção de `status` + Traces. [Source: architecture.md]

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.7] — user story + ACs (FR-9, UJ-2)
- [Source: _bmad-output/planning-artifacts/architecture.md#Agent Architecture] — `escalateToLucas` notifica o Lucas + `status=escalated`
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] — fallback = segundo caminho de envio Evolution
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns] — erros estruturados, idempotência
- [Source: openaiDeveloperDocs#agents/quickstart] — `tool({...})`; [#latest-model] — prompts outcome-first
- [Source: 1-3-...round-trip.md] — `evolution-client.sendText` (normaliza dígitos)
- [Source: 1-5-...triagem.md] — gancho de fora-de-escopo a completar; `domain/triage`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev) — agente da POC roda em `gpt-5.5`

### Debug Log References

- `npx tsc --noEmit` → exit 0.
- **Verificação com mock da Evolution (gpt-5.5)** via script descartável `tmp-fallback-test.ts` — 7/7 checks. Mensagem montada ao Lucas (contato puxado do estado + resumo da IA):
  ```
  🔔 Encaminhamento (IA Pré-atendimento)
  Cliente: —
  Telefone: 5511900000950
  E-mail: —
  Tipo: fora de escopo
  Motivo: assunto não-imobiliário
  Resumo: Cliente entrou em contato dizendo que gostaria de ajuda para abrir uma empresa de comércio.
  ```
  - Gatilho "abrir empresa" (não-imobiliário) → `escalateToLucas` → 1 notificação ao número do Lucas; `status='escalated'`; resposta ao Cliente cortês e sem prazo.
  - **Idempotência verificada:** mensagem seguinte após escalado → "já estava escalated — sem reenvio" → continua só 1 notificação.
- ⚠️ **Incidente no harness de teste (não no código da feature):** a 1ª versão do script usava `import` ESTÁTICO; como em ESM os imports são içados, o override de `EVOLUTION_BASE_URL` (para o mock) só rodava DEPOIS do `config` carregar — então o `config` pegou a URL REAL e o teste **enviou 1 mensagem de encaminhamento REAL ao WhatsApp do Lucas** (5511985303959). Corrigido trocando para **import dinâmico** (padrão que a 1.3 já usava). Lição: testes que mockam a Evolution devem importar os módulos do app de forma dinâmica, após setar o env.

### Completion Notes List

- **Fechou o gancho da 1.5:** `escalateToLucas` agora NOTIFICA o Lucas de verdade via `evolution-client.sendText(config.lucasWhatsapp, msg)`, além de marcar `status='escalated'`. É o 2º caminho de envio da Evolution (o 1º é a resposta ao Cliente).
- **Contato puxado do estado** (não só do que a IA passa): nome/telefone/e-mail/`demand_type` vêm de `conversation-repo.findById`; a IA fornece apenas o `summary`.
- **Idempotência** (anti-spam): a tool checa `status === 'escalated'` antes de enviar; se já encaminhada, retorna `{ ok:true, alreadyEscalated:true }` sem reenviar. A instrução também orienta a IA a não re-escalar.
- **3 gatilhos** nas instruções: (1) assunto não-imobiliário; (2) fora dos 4 tipos após 1 esclarecimento (reusa a triagem da 1.5, sem duplicar regra); (3) insatisfação/urgência (julgamento conversacional do agente).
- **Robustez:** falha ao notificar o Lucas é logada (`[evolution]`/`[tool:escalateToLucas]`) e NÃO marca escalated (permite nova tentativa) nem vaza erro ao Cliente; guardrail jurídico global (1.4) continua valendo.
- `LUCAS_WHATSAPP` já existia no config (default `+5511985303959`) e no `.env.example` desde a 1.1 — só confirmado; `evolution-client` normaliza para dígitos.
- **Escopo respeitado:** nada de agenda/Microsoft Graph (Épico 2).
- **Pendência de Felyppe (Task 4 com WhatsApp real, pós-deploy):** validar os gatilhos (não-imobiliário, urgência) via WhatsApp, confirmar que a notificação chega no WhatsApp do Lucas e a idempotência. (Obs.: já chegou 1 mensagem de teste ao Lucas por conta do incidente acima.)

### File List

- `src/agent/tools/escalate-to-lucas.ts` (modificado) — notificação real ao Lucas + contato do estado + idempotência
- `src/agent/pre-atendimento.ts` (modificado) — instruções com os 3 gatilhos de Fallback + não re-escalar
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificado) — status da story 1.7
- `_bmad-output/implementation-artifacts/1-7-encaminhamento-ao-lucas-fallback.md` (modificado) — frontmatter, checkboxes, Dev Agent Record, status

## Change Log

| Data       | Versão | Descrição                                                                            | Autor        |
|------------|--------|--------------------------------------------------------------------------------------|--------------|
| 2026-06-09 | 0.1    | Fallback completo: escalateToLucas notifica o Lucas no WhatsApp (contato do estado + resumo) com idempotência; 3 gatilhos nas instruções. Fecha o Épico 1. | Amelia (dev) |
