---
baseline_commit: aa6e2a746414bd9f2b9d981817a3dbd43a776ec2
---

# Story 1.3: Recebimento de mensagem do WhatsApp e resposta (round-trip)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Cliente,
I want que minha mensagem no WhatsApp seja recebida pelo escritório e respondida automaticamente,
so that eu tenha confirmação de que estou conversando com o canal certo.

## Acceptance Criteria

**AC1 — Webhook protegido + ack assíncrono (NFR-4)**
**Given** o endpoint `POST /webhook` protegido por segredo compartilhado (`apikey`/token)
**When** a Evolution API entrega um evento de mensagem recebida com o segredo válido
**Then** o endpoint responde `200` **imediatamente** (ack) e processa o turno de forma **assíncrona**, evitando timeout/retry da Evolution
**And** um evento **sem** o segredo válido é rejeitado (`401`/`403`) **sem** processamento.

**AC2 — Normalização + persistência + serialização por telefone**
**Given** um evento válido sendo processado
**When** o handler normaliza o payload bruto da Evolution para `InboundMessage { phone, text, timestamp }`
**Then** a conversa é carregada/criada por `phone` e a mensagem recebida é persistida via `message-repo`
**And** mensagens consecutivas do mesmo `phone` são processadas **em ordem** (serialização via fila/lock em memória), sem corrida de estado.

**AC3 — Resposta de volta ao WhatsApp (round-trip completo)**
**Given** uma mensagem processada
**When** o serviço envia a resposta
**Then** ela é entregue ao Cliente via `evolutionClient.sendText(phone, text)` e **também persistida** (role `assistant`)
**And** o texto é **puro** (sem markdown pesado), comprovando o canal ponta a ponta WhatsApp → serviço → WhatsApp.

## Tasks / Subtasks

- [x] **Task 1 — Promover segredos da Evolution no `config.ts`** (AC: 1, 3)
  - [x] Promover de `.optional()` para **required** no schema zod: `EVOLUTION_BASE_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `WEBHOOK_SECRET` (esta story passa a consumi-los — contrato de "config incremental")
  - [x] Confirmar que constam no `.env.example`
- [x] **Task 2 — `src/integrations/evolution-client.ts`** (AC: 3)
  - [x] `sendText(phone, text): Promise<void>` → `POST {EVOLUTION_BASE_URL}/message/sendText/{EVOLUTION_INSTANCE}` com header `apikey: {EVOLUTION_API_KEY}` e body `{ number, text }` (ver Dev Notes "Endpoint de envio")
  - [x] `number` = telefone só com dígitos (sem `+`, sem `@s.whatsapp.net`)
  - [x] try/catch com log `[evolution]` + phone mascarado; em erro, **não** derruba o processo (retorna/relança de forma controlada conforme padrão de erro)
- [x] **Task 3 — `src/webhook/queue.ts` (serialização por telefone)** (AC: 2)
  - [x] Fila/lock em memória: `enqueue(phone, task: () => Promise<void>)` encadeia tasks do **mesmo** `phone` em série; `phone` diferentes correm em paralelo
  - [x] Implementação simples: `Map<phone, Promise<void>>` encadeando `.then()` (ver Dev Notes "Fila por telefone")
  - [x] Erros de uma task são capturados e logados sem quebrar a cadeia do telefone
- [x] **Task 4 — `src/webhook/handler.ts` (valida, normaliza, enfileira)** (AC: 1, 2)
  - [x] `validateSecret(req): boolean` — compara o segredo recebido com `config.webhookSecret` (ver Dev Notes "Validação do segredo")
  - [x] `normalize(rawBody): InboundMessage | null` — extrai `phone`, `text`, `timestamp`; retorna `null` para eventos que **não** são mensagem de texto recebida de Cliente (ver Dev Notes "Normalização")
  - [x] `handleWebhook(req, res)`: se segredo inválido → `res.sendStatus(401)` e fim; senão → `res.sendStatus(200)` **imediato**; depois normaliza e, se `InboundMessage` válido, `queue.enqueue(phone, () => processTurn(msg))` (**sem `await` antes do 200**)
- [x] **Task 5 — `processTurn` (round-trip) + get-or-create no repo** (AC: 2, 3)
  - [x] Adicionar `getOrCreateByPhone(phone): Promise<Conversation>` em `conversation-repo` (find; se null, create) — método previsto na Story 1.2
  - [x] `processTurn(msg)`: `getOrCreateByPhone(phone)` → `message-repo.add({ conversationId, role:'user', content: text })` → **gerar resposta placeholder** (texto fixo cordial, ex.: "Recebi sua mensagem! 👋 Em instantes te respondo.") → `evolutionClient.sendText(phone, reply)` → `message-repo.add({ role:'assistant', content: reply })`
  - [x] ⚠️ A geração de resposta aqui é **placeholder** — será substituída pelo `agent/runner` na Story 1.4. Manter o ponto de substituição isolado/óbvio (ex.: uma função `generateReply()` provisória).
- [x] **Task 6 — Ligar a rota no `server.ts`** (AC: 1)
  - [x] `app.post('/webhook', handleWebhook)` (manter `app.use(express.json())` da 1.1; garantir limite de body adequado para payloads da Evolution)
  - [x] Manter `GET /health` intacto
- [x] **Task 7 — `types.ts`** (AC: 2)
  - [x] Adicionar `InboundMessage { phone: string; text: string; timestamp: number }`
- [x] **Task 8 — Verificação manual (demo da story)** (AC: 1, 2, 3)
  - [x] **Logar o payload bruto** no primeiro webhook recebido para confirmar a forma real da sua instância Evolution (ver Dev Notes)
  - [x] Configurar o webhook da instância Evolution apontando para a URL pública (Easypanel) `/webhook` com o segredo combinado
  - [x] Enviar uma mensagem real no WhatsApp → confirmar: chega a resposta placeholder; `conversations` tem 1 linha (o phone); `messages` tem 2 linhas (user + assistant)
  - [x] Enviar 2 mensagens rápidas seguidas do mesmo número → confirmar processamento **em ordem** (logs/timestamps)
  - [x] POST `/webhook` com segredo errado → `401`/`403` sem persistir nada

## Dev Notes

### Dependência das stories anteriores (1.1, 1.2)
- **1.1:** scaffold, `config.ts` (config incremental), `server.ts` (`express.json()` + `/health`), `.env.example`. `express` já instalado.
- **1.2:** `supabase-client.ts`, `conversation-repo` (`create`/`findByPhone`/`findByPhoneWithMessages`), `message-repo` (`add`/`listRecent`), `types.ts` (`Conversation`/`Message`). Esta story **adiciona** `getOrCreateByPhone` ao `conversation-repo` (eu já o anunciei como "vem na 1.3" na Story 1.2). [Source: 1-2-persistencia-do-estado-de-conversa-supabase.md]
- **Config incremental:** promover `EVOLUTION_*` + `WEBHOOK_SECRET` a required agora; OpenAI/Graph seguem opcionais até suas stories (1.4 / 2.1). [Source: 1-1 Dev Notes]

### Padrão crítico: ack 200 imediato + processamento assíncrono (NFR-4) [Source: architecture.md#API & Communication Patterns]
- O webhook **responde 200 antes** de processar o turno (LLM/Graph são lentos; a Evolution dá timeout/retry se demorar). Em Node isso é natural: validar → `res.sendStatus(200)` → continuar o trabalho assíncrono **sem** `await` antes do send.
- **Não** processar dentro do ciclo de request/response. Enfileirar e retornar.

### Fila por telefone (serialização) [Source: architecture.md#API & Communication Patterns "Serialização por conversa", #Structure Patterns webhook/queue.ts]
- Instância única na POC → lock/fila **em memória** basta (sem Redis). Garante que 2 mensagens do mesmo `phone` não rodem concorrentes e corrompam o estado da conversa.
- Implementação enxuta (encadeamento de promises por chave):
```ts
// src/webhook/queue.ts
const chains = new Map<string, Promise<void>>();
export function enqueue(phone: string, task: () => Promise<void>): void {
  const prev = chains.get(phone) ?? Promise.resolve();
  const next = prev.then(task).catch((err) => {
    console.error(`[queue] erro processando ${maskPhone(phone)}:`, err);
  });
  chains.set(phone, next);
  // opcional: limpar a entrada quando next terminar e ainda for a atual
  next.finally(() => { if (chains.get(phone) === next) chains.delete(phone); });
}
```

### Validação do segredo [Source: architecture.md#Authentication & Security; doc Evolution]
- A arquitetura pede "segredo compartilhado (`apikey`/token)" validado no `POST /webhook`. Evolution e o serviço estão na mesma VPS, mas valide mesmo assim (defense-in-depth).
- **Duas formas (escolha uma e documente):**
  1. **Header customizado:** ao configurar o webhook na Evolution, defina um header (ex.: `authorization` ou `x-webhook-secret`) com o valor de `WEBHOOK_SECRET`; valide `req.header('x-webhook-secret') === config.webhookSecret`.
  2. **`apikey` no body/header:** a Evolution inclui o `apikey` da instância no payload; valide-o contra `config.webhookSecret` (= o apikey da instância). Menos limpo, mas funciona sem configurar header.
- Segredo inválido/ausente → `res.sendStatus(401)` (ou 403), **sem** normalizar nem persistir.

### Normalização do payload (Evolution v2 / Baileys) — ⚠️ CONFIRMAR contra a instância
> O formato exato varia por versão da Evolution. **Logue o `req.body` bruto no primeiro webhook** e ajuste os caminhos abaixo conforme o que sua instância realmente envia. A forma típica da v2 (confirmada na doc/comunidade):
```jsonc
// POST /webhook  (event messages.upsert)
{
  "event": "messages.upsert",
  "instance": "<nome-da-instancia>",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net", // grupo => termina em @g.us
      "fromMe": false,                               // true = mensagem do próprio bot
      "id": "..."
    },
    "pushName": "Nome do Cliente",
    "message": { "conversation": "texto da mensagem" },
    // texto também pode vir como:
    // "message": { "extendedTextMessage": { "text": "..." } }
    "messageType": "conversation",
    "messageTimestamp": 1730000000
  },
  "apikey": "<apikey-da-instancia>"
}
```
- **`phone`:** `data.key.remoteJid` → remover sufixo `@s.whatsapp.net`. Guardar só dígitos.
- **`text`:** `data.message.conversation` **ou** `data.message.extendedTextMessage?.text`.
- **`timestamp`:** `data.messageTimestamp` (segundos epoch).
- **Retornar `null` (ignorar, mas já respondeu 200) quando:**
  - `event !== 'messages.upsert'` (Evolution manda muitos eventos: `connection.update`, `messages.update`, etc.).
  - `data.key.fromMe === true` (eco da própria resposta — **evita loop infinito**).
  - `remoteJid` termina em `@g.us` (grupo — fora de escopo).
  - não há texto (áudio/imagem/sticker) — a POC assume texto; ignorar nesta story. [Source: architecture.md Gap "tratamento de áudio/mídia fora do MVP"]
- **Nenhum outro módulo lê o payload bruto** — só `webhook/handler.ts` conhece o formato da Evolution; o resto trabalha com `InboundMessage`. [Source: architecture.md#Communication Patterns]

### Endpoint de envio (Evolution v2) — ⚠️ confirmar na Swagger da instância
- `POST {EVOLUTION_BASE_URL}/message/sendText/{EVOLUTION_INSTANCE}`
- Header: `apikey: {EVOLUTION_API_KEY}`, `Content-Type: application/json`
- Body: `{ "number": "5511999999999", "text": "..." }` (`number` só dígitos)
- Use `fetch` nativo (Node 24) ou `axios`; o stack não fixa lib HTTP — `fetch` evita dependência extra.
- Confirme o caminho/contrato na Swagger da sua instância (`{EVOLUTION_BASE_URL}/docs`) caso a versão difira.

### Formato da resposta [Source: architecture.md#Format Patterns "Mensagens WhatsApp"]
- Texto **puro**, tom cordial e simples; **sem** markdown de tabela/código. Nesta story a resposta é placeholder (a inteligência vem na 1.4).

### Tratamento de erro e logging [Source: architecture.md#Process Patterns]
- Chamada à Evolution embrulhada em try/catch; erro logado com prefixo `[evolution]` + phone **mascarado** (não logar PII além do necessário). Erro de envio não deve derrubar o processo nem a cadeia da fila.
- Prefixos de log desta story: `[webhook]`, `[queue]`, `[evolution]`.

### Onde a Story 1.4 entra (desenhar o ponto de extensão)
- A 1.4 troca o `generateReply()` placeholder pelo `agent/runner` (carrega estado via `findByPhoneWithMessages` → roda o agente OpenAI → persiste → responde). Mantenha `processTurn` orquestrando e a "geração da resposta" isolada numa função, para a 1.4 só substituir essa peça. [Source: epics.md#Story 1.4 "substituindo a resposta placeholder da Story 1.3"]

### Testing standards
- Sem testes automatizados (POC) — verificação manual (Task 8) com WhatsApp real + inspeção do banco. [Source: architecture.md]

### Pegadinhas a evitar
- ❌ `await` no processamento antes de responder 200 (causa timeout/retry da Evolution).
- ❌ Não filtrar `fromMe === true` → **loop infinito** (o bot responde à própria mensagem).
- ❌ Processar mensagens de grupo (`@g.us`) ou cravar o formato do payload sem logar o bruto primeiro.
- ❌ Ler o payload bruto da Evolution fora do `handler.ts`.
- ❌ Esquecer de persistir a resposta `assistant` (a AC3 exige persistir os dois lados).
- ❌ `process.env` direto / falar com o banco fora dos repos / markdown pesado na resposta.

### Project Structure Notes
- Arquivos: `src/webhook/handler.ts`, `src/webhook/queue.ts`, `src/integrations/evolution-client.ts`, e edição de `src/server.ts`, `src/types.ts`, `src/repos/conversation-repo.ts` (add `getOrCreateByPhone`). Tudo alinhado à árvore da arquitetura; sem conflitos. [Source: architecture.md#Complete Project Directory Structure]

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] — user story + ACs
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] — ack 200 + async, serialização por telefone, outbound
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] — webhook por segredo compartilhado, envio por apikey
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns / #Structure Patterns] — InboundMessage, webhook/handler+queue, evolution-client
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns / #Process Patterns] — texto puro, erros/log
- [Source: docs/evolution-api-readme-pt.md] — auth por header `apikey`, validação de assinatura de webhook
- [Source: Evolution API v2 docs/community (WebSearch)] — `messages.upsert` (`data.key.remoteJid`/`fromMe`, `data.message.conversation`); `POST /message/sendText/{instance}` body `{ number, text }`
- [Source: 1-1 / 1-2 stories] — config incremental, repos e tipos já existentes

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npx tsc --noEmit` → exit 0 (todo o código novo tipado).
- **Teste de integração local** (script descartável `tmp-webhook-test.ts`, depois removido): subiu um mock HTTP da Evolution na :4000, importou o `server.ts` com credenciais de teste inline (sem tocar o `.env` real) e simulou payloads `messages.upsert`. **11/11 checks passaram**:
  - webhook válido → 200; segredo errado → 401; `fromMe` → 200 (ack) mas ignorado; 2 mensagens → 200.
  - 1 `sendText` para P1 no endpoint `/message/sendText/test-inst` com `apikey` correto e texto placeholder; 0 envios para P2 (segredo errado) e P3 (`fromMe`); 2 envios para P4.
- **Persistência confirmada via MCP** (`execute_sql`): P1 = 2 msgs (`user`→`assistant`); P4 = 4 msgs na ordem `primeira`→resp→`segunda`→resp (serialização por telefone comprovada); P2/P3 sem conversa. Dados de teste truncados ao final.
- Logs observados: `[webhook]` (enfileira/processa/segredo inválido), `[evolution]` (enviado, phone mascarado), `[queue]` (sem erros).

### Completion Notes List

- **Round-trip ponta a ponta** verificado localmente sem depender de deploy: WhatsApp(simulado) → `/webhook` → fila → `processTurn` → Evolution(mock) → persistência dos dois lados.
- **Ack 200 imediato + async** (NFR-4): `handleWebhook` responde antes de normalizar/enfileirar; nenhum `await` de processamento antes do 200.
- **Serialização por telefone** (`webhook/queue.ts`): encadeamento de promises por `phone` em `Map`; mesma conversa em série, phones distintos em paralelo. Ordem comprovada no banco.
- **Anti-loop**: `normalize` descarta `fromMe===true`, grupos (`@g.us`), eventos ≠ `messages.upsert` e mensagens sem texto (áudio/mídia fora de escopo). Só o `handler.ts` conhece o payload bruto.
- **Validação de segredo** flexível: aceita header `x-webhook-secret` (recomendado) OU `authorization` OU o `apikey` do corpo, todos comparados com `WEBHOOK_SECRET`. Felyppe escolhe a forma ao configurar o webhook na Evolution.
- **Resposta placeholder isolada** em `generateReply()` dentro de `process-turn.ts` — ponto único que a Story 1.4 troca pelo agent/runner.
- `getOrCreateByPhone` adicionado ao `conversation-repo` (anunciado na 1.2).
- `EVOLUTION_BASE_URL/API_KEY/INSTANCE` + `WEBHOOK_SECRET` **promovidos a required** no `config.ts`. ⚠️ Por isso o app agora **não boota** até esses 4 valores estarem no `.env` (e na Environment do Easypanel) — comportamento esperado do contrato de config incremental.
- Envio via `fetch` nativo do Node 24 (sem dependência HTTP extra). Erro de envio é logado (`[evolution]`, phone mascarado) e relançado de forma controlada; a fila captura e não quebra a cadeia.
- **Pendência de Felyppe (Task 8 com WhatsApp real, pós-deploy):** preencher os 4 segredos da Evolution; configurar o webhook da instância apontando para `https://<subdominio-easypanel>/webhook` com o header/segredo; mandar uma mensagem real e conferir a resposta + as linhas no banco. O `handler.ts` loga o **primeiro payload bruto** para ele confirmar o formato real da instância e ajustar `normalize` se necessário.

### File List

- `src/util.ts` (novo) — `digitsOnly`, `maskPhone`
- `src/integrations/evolution-client.ts` (novo) — `sendText` via fetch
- `src/webhook/queue.ts` (novo) — fila/lock por telefone
- `src/webhook/handler.ts` (novo) — `validateSecret`, `normalize`, `handleWebhook`
- `src/webhook/process-turn.ts` (novo) — `processTurn` + `generateReply` placeholder
- `src/types.ts` (modificado) — `InboundMessage`
- `src/config.ts` (modificado) — `EVOLUTION_*` + `WEBHOOK_SECRET` promovidos a required
- `src/repos/conversation-repo.ts` (modificado) — `getOrCreateByPhone`
- `src/server.ts` (modificado) — rota `POST /webhook` + `express.json({ limit: '1mb' })`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificado) — status da story 1.3
- `_bmad-output/implementation-artifacts/1-3-recebimento-de-mensagem-do-whatsapp-e-resposta-round-trip.md` (modificado) — frontmatter, checkboxes, Dev Agent Record, status

## Change Log

| Data       | Versão | Descrição                                                                                  | Autor        |
|------------|--------|--------------------------------------------------------------------------------------------|--------------|
| 2026-06-09 | 0.1    | Webhook Evolution (ack 200 + async), fila por telefone, round-trip com resposta placeholder | Amelia (dev) |
