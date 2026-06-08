---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-POC_IA_Atendimento-2026-06-07/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/briefs/brief-POC_IA_Atendimento-2026-06-07/brief.md'
  - 'docs/evolution-api-readme-pt.md'
---

# POC_IA_Atendimento - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for POC_IA_Atendimento, decomposing the requirements from the PRD and Architecture requirements into implementable stories. (Sem documento de UX — a POC é um serviço backend cujo canal é o WhatsApp, sem UI própria.)

## Requirements Inventory

### Functional Requirements

FR-1: Saudação e abertura — Ao receber a primeira mensagem de um número desconhecido, a IA responde com saudação que se identifica como assistente automatizado do "Escritório do Lucas" e pergunta no que pode ajudar. Responde 24/7 (agendamento só na janela comercial). (UJ-1)
FR-2: Triagem do tipo de demanda — A IA interpreta a descrição livre do Cliente e a classifica em exatamente um dos quatro Tipos de Demanda (compra/venda, locação, regularização/cartório, distrato/disputas), refletindo o entendimento de volta para confirmação; se não corresponder a nenhum tipo após uma tentativa de esclarecimento, aciona Fallback (FR-9). Nunca emite opinião jurídica. (UJ-1)
FR-3: Coleta de dados do Cliente — A IA coleta de forma conversacional nome completo, e-mail (validado em formato), resumo do caso e preferência de horário; o telefone vem do WhatsApp. Não avança para a oferta de Slots enquanto nome, e-mail e resumo não estiverem coletados. (UJ-1)
FR-4: Escolha do formato da reunião — A IA pergunta se a Reunião será online ou presencial e registra a escolha. Online → Convite com link Teams; presencial → endereço do escritório (Rua Maria Máximo 153, Ponta da Praia, Santos/SP). O formato é registrado no Briefing. (UJ-1)
FR-5: Consulta de disponibilidade e oferta de Slots — A IA consulta a Agenda do Lucas e oferece apenas Slots livres (seg-sex, 9h–18h, blocos de 1h), no máximo 3 por vez, priorizando a preferência de horário coletada; nunca oferece horário ocupado nem fora da janela. (UJ-1)
FR-6: Confirmação do horário — A IA repete data, hora e formato e pede confirmação explícita antes de criar o Convite; se o Slot ficou indisponível entre oferta e confirmação, avisa e reoferece (FR-5). (UJ-1)
FR-7: Criação do Convite e trava da Agenda — A IA cria um evento na Agenda do Lucas no Slot confirmado, com Cliente e Lucas como participantes, travando o horário; envia o Convite por e-mail a ambos; online gera link de videochamada (Teams), presencial inclui o endereço. (UJ-1)
FR-8: Briefing para o Lucas — A IA gera um Briefing estruturado (nome do Cliente, Tipo de Demanda, resumo do caso em 2–3 linhas, formato da reunião, contato telefone+e-mail) e o anexa ao evento, legível na descrição da Agenda sem abrir o WhatsApp. (UJ-1, UJ-2)
FR-9: Encaminhamento ao Lucas (Fallback) — A IA reconhece situações fora do escopo (assunto não-imobiliário, demanda fora dos 4 tipos após esclarecimento, ou sinal de insatisfação/urgência) e notifica o Lucas por WhatsApp (+55 11 98530-3959, configurável) com resumo da conversa e contato do Cliente, informando o Cliente com cortesia de que será encaminhado, sem prometer prazo. (UJ-2)

### NonFunctional Requirements

NFR-1: Guardrail jurídico (crítico) — A IA nunca emite orientação, opinião ou interpretação jurídica sobre o caso; diante de pedido de orientação, redireciona para o agendamento ou Fallback. Sempre se identifica como assistente automatizado; nunca se passa por advogado ou humano. (PRD §10.1)
NFR-2: Consistência de agenda — Nenhum Slot ocupado é ofertado ou criado; o calendário é a fonte da verdade e a disponibilidade é re-checada imediatamente antes de criar o evento (corrida oferta↔confirmação). (SM-2)
NFR-3: Disponibilidade / janela de operação — A IA responde 24/7; o agendamento ocorre apenas seg-sex, 9h–18h, em blocos de 1h, no timezone America/Sao_Paulo.
NFR-4: Latência percebida — A IA responde em "poucos segundos" [ASSUMPTION]; o webhook responde 200 imediatamente e processa o turno de forma assíncrona para evitar timeout/retry da Evolution.
NFR-5: Privacidade (LGPD) — Dados pessoais (nome, telefone, e-mail, descrição) restritos ao banco da demo, tratamento controlado; uso e retenção formais ficam para a produção. [ASSUMPTION: consentimento informal na demo.]
NFR-6: Custo — Inferência via OpenAI tem custo por token; na POC o volume é de demonstração (~5 contatos/dia); dimensionamento formal fica para produção.
NFR-7: Maturidade (demo) — Sem requisitos de alta disponibilidade, escala, volume ou monitoramento/observabilidade de produção; instância única, deploy manual.

### Additional Requirements

- **Starter / scaffold (Epic 1, Story 1):** Scaffold mínimo TypeScript/Node.js 24 LTS (ESM, `tsx watch` em dev) + OpenAI Agents SDK (`@openai/agents`) + Express + `@supabase/supabase-js` + `dotenv` + `@azure/identity`/`@microsoft/microsoft-graph-client`. A inicialização do projeto é a primeira story de implementação.
- **Pré-requisito de infraestrutura Microsoft (bloqueia FR-4/5/7):** Provisionar tenant Microsoft 365 Developer + app registration no Entra ID + permissão Application `Calendars.ReadWrite` + admin consent (Felyppe é admin). Conta M365 work/school é obrigatória para free/busy + Teams (MSA pessoal não suporta).
- **Auth Microsoft Graph app-only:** `ClientSecretCredential` (`@azure/identity`) → `@microsoft/microsoft-graph-client`; chamadas sobre `/users/{LUCAS_USER_ID}/calendar/...`. Sem refresh token interativo.
- **Modelo de dados / migrations Supabase:** tabelas `conversations`, `messages`, `appointments` (snake_case, PK uuid, timestamptz), RLS habilitado em todas as tabelas (defense-in-depth), acesso server-only via service role key.
- **Processamento do webhook:** `POST /webhook` valida segredo compartilhado (`apikey`/token), normaliza evento → `InboundMessage`, responde 200 imediato e processa de forma assíncrona; serialização por telefone (lock/fila em memória) para evitar corrida de estado.
- **Estado de conversa multi-turno:** carregar `conversations` + `messages` recentes por `phone` a cada turno; persistir resposta e novo estado via repositórios (conversão snake_case↔camelCase só na camada repo).
- **Config externalizada:** `.env` validado por zod em `config.ts` como única fonte (segredos OpenAI/Graph/Evolution, número do Lucas, endereço, janela comercial, máx. de slots). Nunca `process.env` espalhado.
- **Envio outbound (Evolution):** `evolutionClient.sendText(phone, text)` para resposta ao Cliente e para o Fallback ao número do Lucas; texto puro, sem markdown pesado, listas de slots numeradas.
- **Timezone:** America/Sao_Paulo em toda a lógica de slots; nas chamadas Graph usar nome de timezone Windows (`E. South America Standard Time`) + header `Prefer: outlook.timezone`.
- **Deploy:** mesma VPS da Evolution API (URL pública estável, sem túnel), processo via PM2 ou Docker, proxy reverso (nginx/Caddy) roteando `/webhook`; healthcheck `GET /health`. Sem CI/CD na POC. Tracing do Agents SDK habilitado para depurar a demo.
- **Tratamento de erro:** chamadas externas (Graph/OpenAI/Evolution) em try/catch; tool retorna resultado de erro estruturado (`{ ok: false, reason }`); o agente responde com cortesia e, se bloqueante, aciona `escalateToLucas`; erros nunca vazam stack/termos técnicos ao cliente.
- **Verificações na implementação (gaps registrados):** validar criação de evento Teams via app-only no primeiro teste (fallback = fluxo delegated); usar usuário de teste do tenant como "Lucas" na demo; confirmar nome exato do modelo OpenAI via MCP no momento de codar.

### UX Design Requirements

N/A — A POC não possui interface de usuário própria; o único canal é o WhatsApp via Evolution API. Não há documento de UX Design e nenhum requisito de design de interface a extrair.

### FR Coverage Map

FR-1: Epic 1 — Saudação e abertura no WhatsApp
FR-2: Epic 1 — Triagem do tipo de demanda (4 tipos)
FR-3: Epic 1 — Coleta conversacional de dados do Cliente
FR-9: Epic 1 — Fallback / encaminhamento ao Lucas por WhatsApp
FR-4: Epic 2 — Escolha do formato (online/presencial)
FR-5: Epic 2 — Consulta de disponibilidade e oferta de Slots
FR-6: Epic 2 — Confirmação do horário
FR-7: Epic 2 — Criação do Convite e trava da Agenda
FR-8: Epic 2 — Briefing para o Lucas

**NFRs:** NFR-1 (guardrail jurídico) → Epic 1, transversal a todos os turnos · NFR-2 (consistência de agenda) → Epic 2 · NFR-3 (24/7 / janela seg-sex 9–18h) → Epic 1 (responde) + Epic 2 (slots) · NFR-4 (latência/ack assíncrono) → Epic 1 · NFR-5 (LGPD) → Epic 1 (data store) · NFR-6 (custo) → transversal · NFR-7 (infra demo) → Epic 1.

## Epic List

### Epic 1: Pré-atendimento conversacional e encaminhamento
Estabelecer o serviço backend na VPS e entregar a camada conversacional completa: o Cliente manda mensagem no WhatsApp, é saudado como assistente do "Escritório do Lucas", tem a demanda triada em um dos 4 Tipos de Demanda (com confirmação), os dados coletados conversacionalmente, e — quando o caso foge do escopo — é encaminhado ao Lucas por WhatsApp. Ao fim do épico há um serviço implantável e demonstrável, com o guardrail jurídico ativo em todos os turnos. Inclui scaffold TS/Node + OpenAI Agents SDK, webhook assíncrono serializado por telefone, migrations Supabase + repositórios, config `.env`/zod, evolution-client, agente core + guardrail, triagem e fallback.
**FRs covered:** FR-1, FR-2, FR-3, FR-9

### Epic 2: Agendamento, Convite e Briefing
Sobre a conversa do Épico 1, permitir que o Cliente saia do WhatsApp com a Reunião marcada: escolhe online ou presencial, recebe até 3 Slots livres da agenda real do Lucas (priorizando sua preferência), confirma o horário, e a IA cria o evento travando o Slot (com link Teams ou endereço do escritório), enviando o Convite por e-mail a ambos com o Briefing estruturado anexado. Inclui provisionar a infraestrutura Microsoft 365 Developer + app registration Graph (`Calendars.ReadWrite`), graph-client (free/busy + createEvent), tool de disponibilidade + `domain/slots`, fluxo de formato+confirmação, e `create-appointment` + `domain/briefing`.
**FRs covered:** FR-4, FR-5, FR-6, FR-7, FR-8

## Epic 1: Pré-atendimento conversacional e encaminhamento

Estabelecer o serviço backend na VPS e entregar a camada conversacional completa: o Cliente manda mensagem no WhatsApp, é saudado como assistente do "Escritório do Lucas", tem a demanda triada em um dos 4 Tipos de Demanda (com confirmação), os dados coletados conversacionalmente, e — quando o caso foge do escopo — é encaminhado ao Lucas por WhatsApp. Ao fim do épico há um serviço implantável e demonstrável, com o guardrail jurídico ativo em todos os turnos. **FRs:** FR-1, FR-2, FR-3, FR-9. **NFRs relevantes:** NFR-1 (guardrail jurídico), NFR-3 (24/7), NFR-4 (ack assíncrono), NFR-5 (LGPD), NFR-7 (infra demo).

### Story 1.1: Inicialização do projeto e healthcheck na VPS

As a Felyppe (desenvolvedor da POC),
I want um scaffold TypeScript/Node com servidor Express, configuração validada e endpoint de saúde,
So that eu tenha uma base implantável na VPS sobre a qual todas as funcionalidades serão construídas.

**Acceptance Criteria:**

**Given** o repositório recém-inicializado conforme o comando do starter (Node 24 LTS, ESM, `@openai/agents`, `express`, `zod`, `@supabase/supabase-js`, `dotenv`, `@azure/identity`, `@microsoft/microsoft-graph-client` instalados)
**When** rodo `npm run dev` (`tsx watch src/server.ts`)
**Then** o servidor Express sobe sem erros
**And** existe `src/config.ts` que lê e valida as variáveis de ambiente via zod, falhando rápido (com mensagem clara) se uma variável obrigatória estiver ausente
**And** existe `.env.example` documentando todas as variáveis (segredos OpenAI/Graph/Evolution, número do Lucas, endereço do escritório, janela comercial, máx. de slots), e `.env` está no `.gitignore`.

**Given** o serviço em execução
**When** faço `GET /health`
**Then** recebo `200` com um corpo simples de status (ex.: `{ "status": "ok" }`)
**And** existe `ecosystem.config.cjs` (PM2) que permite subir o processo na VPS atrás do proxy reverso existente.

### Story 1.2: Persistência do estado de conversa (Supabase)

As a sistema de pré-atendimento,
I want armazenar conversas e mensagens por número de WhatsApp,
So that eu mantenha contexto multi-turno entre as mensagens de um mesmo Cliente.

**Acceptance Criteria:**

**Given** o projeto Supabase configurado e a service role key no `.env`
**When** aplico a migration `0001_init.sql`
**Then** são criadas as tabelas `conversations` (`id` uuid PK, `phone` text unique, `status` text, `demand_type` text, `meeting_format` text, `collected` jsonb, `created_at`/`updated_at` timestamptz) e `messages` (`id` uuid PK, `conversation_id` uuid FK, `role` text, `content` text, `created_at` timestamptz)
**And** ambas as tabelas têm RLS habilitado (sem policies — só a service role opera)
**And** `status`, `demand_type` e `meeting_format` têm CHECK restringindo aos valores válidos.

**Given** as tabelas criadas e `supabase-client.ts` usando a service role key (server-only)
**When** o `conversation-repo` cria/atualiza uma conversa e o `message-repo` registra uma mensagem
**Then** os dados persistem corretamente e a conversão `snake_case` (DB) ↔ `camelCase` (app) ocorre só na camada de repositório
**And** buscar uma conversa por `phone` retorna a conversa com suas mensagens recentes.

### Story 1.3: Recebimento de mensagem do WhatsApp e resposta (round-trip)

As a Cliente,
I want que minha mensagem no WhatsApp seja recebida pelo escritório e respondida automaticamente,
So that eu tenha confirmação de que estou conversando com o canal certo.

**Acceptance Criteria:**

**Given** o endpoint `POST /webhook` protegido por segredo compartilhado (`apikey`/token)
**When** a Evolution API entrega um evento de mensagem recebida com o segredo válido
**Then** o endpoint responde `200` imediatamente (ack) e processa o turno de forma assíncrona, evitando timeout/retry da Evolution (NFR-4)
**And** um evento sem o segredo válido é rejeitado (`401`/`403`) sem processamento.

**Given** um evento válido sendo processado
**When** o handler normaliza o payload bruto da Evolution para `InboundMessage { phone, text, timestamp }`
**Then** a conversa é carregada/criada por `phone` e a mensagem recebida é persistida via `message-repo`
**And** mensagens consecutivas do mesmo `phone` são processadas em ordem (serialização via fila/lock em memória), sem corrida de estado.

**Given** uma mensagem processada
**When** o serviço envia a resposta
**Then** ela é entregue ao Cliente via `evolutionClient.sendText(phone, text)` e também persistida
**And** o texto é puro (sem markdown pesado), comprovando o canal ponta a ponta WhatsApp → serviço → WhatsApp.

### Story 1.4: Saudação e abertura pelo agente com guardrail jurídico

As a Cliente que faz o primeiro contato,
I want ser saudado de forma natural por um assistente que se identifica claramente,
So that eu saiba com quem estou falando e me sinta à vontade para explicar minha demanda.

**Realiza:** FR-1, NFR-1.

**Acceptance Criteria:**

**Given** o agente "Pré-atendimento" (OpenAI Agents SDK) com `runner` que carrega estado → roda o agente → persiste → responde, substituindo a resposta placeholder da Story 1.3
**When** um número desconhecido envia a primeira mensagem
**Then** a IA responde com uma saudação que se identifica como assistente automatizado do **"Escritório do Lucas"** e pergunta no que pode ajudar
**And** a saudação é cordial e simples, deixa claro que é atendimento automatizado e **não** se passa por humano nem por advogado
**And** a IA responde 24/7 (NFR-3).

**Given** o guardrail jurídico de saída ativo em todos os turnos (NFR-1)
**When** o Cliente, em qualquer momento, pede orientação/opinião jurídica
**Then** a IA **nunca** emite orientação, opinião ou interpretação jurídica
**And** redireciona com cortesia para o agendamento ou para o Fallback
**And** o tracing do Agents SDK está habilitado para depurar a demo.

### Story 1.5: Triagem do tipo de demanda

As a Cliente,
I want descrever minha situação em linguagem leiga e ser entendido,
So that o escritório saiba do que se trata antes de marcar a conversa.

**Realiza:** FR-2.

**Acceptance Criteria:**

**Given** o Cliente descreveu sua demanda em linguagem livre
**When** a IA interpreta a descrição
**Then** ela atribui **exatamente um** dos quatro Tipos de Demanda (compra/venda, locação, regularização/cartório, distrato/disputas) e registra em `conversations.demand_type`
**And** reflete o entendimento de volta ao Cliente e pede confirmação antes de prosseguir.

**Given** uma descrição que não corresponde a nenhum Tipo de Demanda (assunto não-imobiliário ou ambíguo)
**When** a IA faz **uma** tentativa de esclarecimento e ainda assim não se enquadra
**Then** a conversa é encaminhada ao Fallback (FR-9, Story 1.7)
**And** em nenhum momento a IA emite opinião jurídica sobre o caso (NFR-1).

### Story 1.6: Coleta conversacional de dados do Cliente

As a Cliente,
I want informar meus dados naturalmente durante a conversa,
So that o escritório tenha o necessário para marcar a reunião sem parecer um formulário.

**Realiza:** FR-3.

**Acceptance Criteria:**

**Given** a demanda já triada e confirmada
**When** a IA conduz a coleta
**Then** ela obtém nome completo, e-mail, resumo do caso e preferência de horário de forma conversacional, registrando em `conversations.collected` (jsonb); o telefone vem do próprio WhatsApp
**And** o e-mail é validado em formato (zod); se inválido, a IA pede novamente.

**Given** a coleta em andamento
**When** nome, e-mail **ou** resumo do caso ainda não foram coletados
**Then** a IA **não** avança para a etapa de agendamento (oferta de Slots)
**And** a preferência de horário (período/dia) é registrada para priorizar a oferta de Slots posteriormente (FR-5).

### Story 1.7: Encaminhamento ao Lucas (Fallback)

As a Lucas,
I want ser avisado por WhatsApp quando um caso foge do escopo da IA,
So that eu assuma manualmente os atendimentos que a IA não deve tratar.

**Realiza:** FR-9, UJ-2.

**Acceptance Criteria:**

**Given** a tool `escalateToLucas(resumo, contato)` e os gatilhos de Fallback definidos
**When** ocorre um dos gatilhos — assunto não-imobiliário, demanda fora dos quatro Tipos após esclarecimento, ou sinal de insatisfação/urgência que a IA não deve tratar
**Then** a IA notifica o **número de WhatsApp do Lucas** (`LUCAS_WHATSAPP`, default +55 11 98530-3959, configurável) com o resumo da conversa e o contato do Cliente
**And** a conversa é marcada com `status = escalated`.

**Given** o Fallback acionado
**When** a IA responde ao Cliente
**Then** ela informa com cortesia que o Dr. Lucas dará sequência, **sem** prometer prazo específico
**And** a IA não emite opinião jurídica nem tenta resolver o caso fora de escopo (NFR-1).

## Epic 2: Agendamento, Convite e Briefing

Sobre a conversa do Épico 1, permitir que o Cliente saia do WhatsApp com a Reunião marcada: escolhe online ou presencial, recebe até 3 Slots livres da agenda real do Lucas (priorizando sua preferência), confirma o horário, e a IA cria o evento travando o Slot (com link Teams ou endereço), enviando o Convite por e-mail a ambos com o Briefing estruturado anexado. **FRs:** FR-4, FR-5, FR-6, FR-7, FR-8. **NFR relevante:** NFR-2 (consistência de agenda — re-checagem na confirmação).

### Story 2.1: Provisionar infraestrutura Microsoft 365 e cliente Graph (app-only)

As a Felyppe (desenvolvedor da POC),
I want um tenant Microsoft 365 com app registration e um cliente Graph autenticado,
So that o agente possa ler a disponibilidade e criar eventos na agenda do Lucas.

**Realiza:** Additional Req (enabler que destrava FR-4/5/7).

**Acceptance Criteria:**

**Given** a necessidade de free/busy + Teams (que exigem conta M365 work/school)
**When** provisiono um tenant Microsoft 365 Developer e registro um app no Entra ID
**Then** o app tem a permissão **Application `Calendars.ReadWrite`** com **admin consent** concedido (Felyppe é admin)
**And** `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET` e `LUCAS_USER_ID` (usuário de teste que representa o Lucas no tenant) estão no `.env` e validados por `config.ts`.

**Given** `graph-client.ts` usando `ClientSecretCredential` (`@azure/identity`) + `@microsoft/microsoft-graph-client` (app-only, sem refresh token interativo)
**When** o cliente faz uma chamada de leitura de calendário sobre `/users/{LUCAS_USER_ID}/calendar/...`
**Then** a autenticação funciona e retorna dados sem erro de permissão
**And** as chamadas usam o timezone Windows `E. South America Standard Time` + header `Prefer: outlook.timezone` (toda a lógica em America/Sao_Paulo).

### Story 2.2: Escolha do formato da reunião

As a Cliente,
I want escolher se a reunião será online ou presencial,
So that eu seja atendido da forma que prefiro.

**Realiza:** FR-4.

**Acceptance Criteria:**

**Given** a demanda triada e os dados coletados (Epic 1)
**When** a IA pergunta o formato da reunião
**Then** o Cliente pode escolher **online** ou **presencial**, e a escolha é registrada em `conversations.meeting_format`.

**Given** o formato escolhido
**When** a conversa avança
**Then** **online** sinaliza que o Convite deverá incluir link de videochamada (Teams), e **presencial** sinaliza que deverá incluir o endereço do escritório (**Rua Maria Máximo 153, Ponta da Praia, Santos/SP**)
**And** o formato fica disponível para constar no Briefing (FR-8, Story 2.5).

### Story 2.3: Consulta de disponibilidade e oferta de Slots

As a Cliente,
I want receber horários livres reais da agenda do advogado,
So that eu escolha um horário que de fato esteja disponível.

**Realiza:** FR-5, NFR-2 (parte), NFR-3.

**Acceptance Criteria:**

**Given** a tool `getAvailability(prefs)` que consulta o calendário do Lucas via Graph (`getSchedule`/free-busy) e gera Slots em `domain/slots.ts`
**When** a IA oferece horários
**Then** são oferecidos **apenas** Slots livres no momento da consulta (calendário = fonte da verdade), **nunca** um horário ocupado
**And** os Slots respeitam **seg-sex, 9h–18h, blocos de 1h**, no máximo **3 por vez**, priorizando a preferência de horário coletada (FR-3)
**And** Slots fora dessa janela não são oferecidos.

**Given** a lista de Slots
**When** a IA a apresenta ao Cliente
**Then** é texto puro com itens numerados (`1)`, `2)`, `3)`)
**And** a geração de Slots usa America/Sao_Paulo (nome de timezone Windows nas chamadas Graph).

### Story 2.4: Confirmação do horário

As a Cliente,
I want confirmar o horário antes de fechar,
So that eu não seja agendado em um horário errado.

**Realiza:** FR-6, NFR-2.

**Acceptance Criteria:**

**Given** o Cliente escolheu um Slot oferecido
**When** a IA registra a escolha
**Then** ela **repete data, hora e formato** e pede **confirmação explícita** antes de criar o Convite (não cria nada sem o "sim").

**Given** o Slot escolhido
**When** ele ficou indisponível entre a oferta e a confirmação
**Then** a IA avisa o Cliente e **reoferece** novos Slots (volta à Story 2.3)
**And** a velocidade de agendar nunca pula a confirmação (counter-metric SM-C2).

### Story 2.5: Criação do Convite, trava da Agenda e Briefing

As a Lucas,
I want que o horário confirmado vire um evento travado na minha agenda com um briefing do caso,
So that o horário fique reservado e eu chegue à reunião já sabendo do que se trata.

**Realiza:** FR-7, FR-8, NFR-2.

**Acceptance Criteria:**

**Given** a tool `createAppointment(slot, dadosCliente, formato)`
**When** o Cliente confirmou o horário (Story 2.4)
**Then** a tool **re-valida a disponibilidade** do Slot via `getSchedule` imediatamente antes de criar (trata a corrida oferta↔confirmação — NFR-2); se o Slot caiu, retorna erro e a IA reoferece
**And** com o Slot ainda livre, cria um `event` no calendário do Lucas que **trava o horário** (deixa de ser oferecível a outro Cliente).

**Given** o evento sendo criado
**When** os participantes são definidos
**Then** o evento tem **Cliente + Lucas** como `attendees`, e o Exchange/Graph dispara os **Convites por e-mail** a ambos (e-mail do Cliente coletado em FR-3)
**And** **online** → o evento inclui link de videochamada (Teams, `isOnlineMeeting`/`teamsForBusiness` → `joinUrl`); **presencial** → inclui o endereço do escritório
**And** o `appointment` é persistido (migration `0002`: tabela `appointments` com `start`/`end`, `format`, `graph_event_id`, `join_url`/endereço, `status`).

**Given** `domain/briefing.ts`
**When** o evento é criado
**Then** o corpo do evento contém o **Briefing estruturado**: nome do Cliente, Tipo de Demanda, resumo do caso (2–3 linhas), formato da reunião e contato (telefone + e-mail)
**And** o Briefing é legível na descrição do evento sem necessidade de abrir o WhatsApp (SM-3, FR-8).
