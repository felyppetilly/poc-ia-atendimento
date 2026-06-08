---
title: "POC — IA de Pré-Atendimento WhatsApp (Advogado Imobiliário)"
status: final
created: 2026-06-07
updated: 2026-06-08
---

# PRD: POC — IA de Pré-Atendimento WhatsApp (Advogado Imobiliário)

## 0. Propósito do Documento

Este PRD é para o Felyppe (quem constrói a POC) e para o Lucas (cliente, advogado imobiliário, quem aprova a demo). Ele traduz o brief aprovado (`briefs/brief-POC_IA_Atendimento-2026-06-07/brief.md`) em requisitos funcionais implementáveis. Vocabulário ancorado no Glossário (§3); features agrupadas com FRs aninhados e numerados globalmente; suposições marcadas com `[ASSUMPTION]` inline e indexadas em §9. Decisões de tecnologia (como integrar Evolution/OpenAI/Calendar) ficam fora daqui — pertencem à arquitetura. Este PRD descreve **capacidades**, não implementação.

## 1. Visão

O Lucas atende pessoalmente o primeiro contato de cada cliente pelo WhatsApp — saudar, entender a demanda e marcar um horário. É repetitivo, frequente e rouba tempo da advocacia. A alternativa seria contratar alguém só pra esse filtro; ele quer automatizar.

Esta POC é um **agente de IA no WhatsApp** que faz o pré-atendimento de ponta a ponta: saúda o cliente, descobre o tipo de demanda imobiliária, coleta o essencial, marca um horário sem conflito na agenda do Lucas e dispara um convite travando a agenda dos dois — com um briefing do assunto, para o Lucas chegar à reunião já sabendo do que se trata. Quando o caso foge do escopo, encaminha pro Lucas assumir.

O entregável é uma **demo** para validar o conceito com o Lucas. Não é produção: o foco é fazer poucas coisas funcionarem de forma convincente — conversa natural, agendamento confiável e briefing útil. Se aprovado, vira produto numa fase seguinte.

## 2. Público-Alvo

### 2.1 Jobs To Be Done

- **Lucas (decisor/beneficiário):** "Quero parar de gastar meu tempo no primeiro contato de cada cliente, sem ter que contratar alguém, e chegar nas reuniões já sabendo do que se trata."
- **Cliente final:** "Quero falar com o escritório agora, ser entendido sem juridiquês e sair com um horário marcado, sem ficar no vai-e-volta."

### 2.2 Não-Usuários (v1)

- Clientes já em atendimento ativo com o Lucas (a POC trata o **primeiro** contato).
- Demandas fora do imobiliário (a IA reconhece e encaminha, não atende).

### 2.3 Jornadas de Usuário (User Journeys)

- **UJ-1. Marina precisa de um advogado pra regularizar a escritura e resolve no WhatsApp.**
  > Marina herdou um imóvel e a escritura está irregular. Acha o contato do escritório e manda "oi" no WhatsApp num sábado à noite. A IA a saúda pelo nome do escritório, pergunta no que pode ajudar. Marina explica em linguagem leiga. A IA identifica que é **regularização/cartório**, confirma que entendeu, pergunta nome, e-mail e se prefere a conversa **online ou presencial** e qual período costuma ser melhor. Marina prefere online, de manhã. A IA consulta a agenda, oferece dois ou três horários livres de manhã, Marina escolhe terça às 10h. A IA confirma, cria o evento com link do Teams e envia o convite pra ela e pro Lucas — com um briefing do caso. Marina fecha o WhatsApp com o horário marcado. **Resolução:** ela recebe o convite no e-mail; o Lucas recebe o mesmo evento com o briefing.

- **UJ-2. Caso espinhoso cai pro Lucas.**
  > Um cliente chega irritado, com um litígio em curso e linguagem agressiva — fora do que a IA deve tratar. A IA reconhece que está fora do escopo, responde com cortesia que vai encaminhar pro Dr. Lucas e **notifica o Lucas por WhatsApp** com o resumo da conversa e o contato. **Resolução:** o Lucas assume manualmente.

## 3. Glossário

- **Pré-atendimento** — O primeiro contato automatizado entre o cliente e o escritório, do "oi" até o agendamento (ou encaminhamento). Escopo desta POC.
- **Cliente** — Pessoa que inicia contato pelo WhatsApp do escritório. Identificada pelo número de telefone.
- **Lucas** — O advogado imobiliário; decisor da POC, dono da Agenda e destinatário do Briefing.
- **Triagem** — Ato de a IA identificar o Tipo de Demanda a partir do que o Cliente descreve.
- **Tipo de Demanda** — Uma de quatro categorias: compra/venda, locação, regularização/cartório, distrato/disputas.
- **Agenda** — Calendário real do Lucas consultado para disponibilidade (Microsoft / Outlook Calendar via Microsoft Graph na POC).
- **Slot** — Janela de horário livre e oferecível ao Cliente (seg-sex, 9h–18h, blocos de 1h).
- **Reunião** — O compromisso agendado entre Cliente e Lucas; pode ser online ou presencial.
- **Convite (Invite)** — Evento criado na Agenda que trava o Slot para Cliente e Lucas.
- **Briefing** — Resumo estruturado do caso, anexado ao Convite, para o Lucas se preparar sem reler a conversa.
- **Fallback** — Encaminhamento ao Lucas quando o caso foge do escopo da IA.

## 4. Features

### 4.1 Recepção e Triagem no WhatsApp

**Description:** O Cliente inicia contato no WhatsApp (via Evolution API). A IA saúda de forma natural e humana, identificando-se como assistente do escritório, e pergunta no que pode ajudar. A partir da resposta em linguagem livre, classifica em um dos quatro Tipos de Demanda e confirma o entendimento com o Cliente antes de seguir. Conduz a coleta dos dados necessários ao agendamento de forma conversacional, sem parecer formulário. Realiza UJ-1. Usa termos do Glossário.

**Functional Requirements:**

#### FR-1: Saudação e abertura

A IA pode receber uma mensagem inicial de um Cliente e responder com uma saudação que se identifica como assistente do escritório e pergunta no que pode ajudar. Realiza UJ-1.

**Consequences (testable):**
- Ao receber a primeira mensagem de um número desconhecido, a IA responde em até [ASSUMPTION: poucos segundos] com saudação + pergunta de abertura.
- A saudação identifica o escritório como **"Escritório do Lucas"** e deixa claro que é um atendimento automatizado/assistente (sem se passar por humano), em tom cordial e simples.
- A IA responde 24/7; o agendamento, porém, só ocorre na janela comercial (FR-5).

#### FR-2: Triagem do tipo de demanda

A IA pode interpretar a descrição livre do Cliente e classificá-la em um dos quatro Tipos de Demanda, confirmando o entendimento antes de prosseguir. Realiza UJ-1.

**Consequences (testable):**
- Dada uma descrição em linguagem leiga, a IA atribui exatamente um Tipo de Demanda dentre os quatro e o reflete de volta ao Cliente para confirmação.
- Se a descrição não corresponder a nenhum Tipo de Demanda (assunto não-imobiliário ou ambíguo após uma tentativa de esclarecimento), aciona o Fallback (FR-9).
- A IA não emite opinião jurídica sobre o caso em nenhum momento (ver §10 Guardrails).

#### FR-3: Coleta de dados do Cliente

A IA pode coletar, de forma conversacional, os dados necessários ao agendamento: nome completo, e-mail, resumo do caso e preferência de horário. O telefone é obtido do próprio WhatsApp. Realiza UJ-1.

**Consequences (testable):**
- A IA não avança para a oferta de Slots enquanto nome, e-mail e resumo do caso não estiverem coletados.
- E-mail coletado é validado em formato; se inválido, a IA pede novamente.
- A preferência de horário (período/dia) é registrada e usada para priorizar a oferta de Slots (FR-5).

### 4.2 Agendamento

**Description:** Com a demanda triada e os dados coletados, a IA pergunta se a Reunião será **online ou presencial**, consulta a Agenda do Lucas, oferece Slots livres priorizando a preferência do Cliente, e confirma a escolha. Realiza UJ-1.

**Functional Requirements:**

#### FR-4: Escolha do formato da reunião

A IA pode perguntar ao Cliente se prefere a Reunião online ou presencial, e registrar a escolha. Realiza UJ-1.

**Consequences (testable):**
- Reunião online → o Convite (FR-7) inclui link de videochamada (Microsoft Teams).
- Reunião presencial → o Convite inclui o endereço do escritório: **Rua Maria Máximo 153, Ponta da Praia, Santos/SP**.
- A escolha de formato é registrada no Briefing (FR-8).

#### FR-5: Consulta de disponibilidade e oferta de Slots

A IA pode consultar a Agenda do Lucas e oferecer ao Cliente Slots livres (seg-sex, 9h–18h, blocos de 1h), priorizando a preferência de horário coletada. Realiza UJ-1.

**Consequences (testable):**
- A IA só oferece Slots que estão livres na Agenda no momento da consulta — nunca um horário já ocupado.
- A IA oferece no máximo [ASSUMPTION: 3] Slots por vez, dentro da janela comercial, priorizando a preferência do Cliente.
- Slots fora de seg-sex 9h–18h não são oferecidos.

#### FR-6: Confirmação do horário

A IA pode registrar o Slot escolhido pelo Cliente e confirmar verbalmente antes de criar o Convite. Realiza UJ-1.

**Consequences (testable):**
- A IA repete data, hora e formato escolhidos e pede confirmação explícita antes de criar o evento.
- Se o Slot escolhido ficou indisponível entre a oferta e a confirmação, a IA avisa e reoferece (FR-5).

### 4.3 Convite e Briefing

**Description:** Confirmado o horário, a IA cria o evento na Agenda, travando o Slot, e envia o Convite para Cliente e Lucas. O evento carrega o Briefing do caso, para o Lucas se preparar sem reler a conversa. Realiza UJ-1.

**Functional Requirements:**

#### FR-7: Criação do Convite e trava da Agenda

A IA pode criar um evento na Agenda do Lucas no Slot confirmado, com Cliente e Lucas como participantes, travando o horário. Realiza UJ-1.

**Consequences (testable):**
- O evento criado bloqueia o Slot na Agenda (o horário deixa de ser oferecível a outro Cliente).
- O Convite é enviado por e-mail ao Cliente (e-mail coletado em FR-3) e ao Lucas.
- Reunião online gera link de videochamada no evento; presencial inclui o endereço.

#### FR-8: Briefing para o Lucas

A IA pode gerar um Briefing estruturado do caso e anexá-lo ao evento, visível ao Lucas. Realiza UJ-1, UJ-2.

**Consequences (testable):**
- O Briefing contém: nome do Cliente, Tipo de Demanda, resumo do caso (2–3 linhas), formato da reunião e contato (telefone + e-mail).
- O Briefing é legível na descrição do evento da Agenda sem necessidade de abrir a conversa do WhatsApp.

### 4.4 Fallback / Escalonamento

**Description:** Quando o caso foge do escopo da IA — assunto não-imobiliário, complexidade alta, cliente insatisfeito — ela responde com cortesia e notifica o Lucas por WhatsApp para assumir. Realiza UJ-2.

**Functional Requirements:**

#### FR-9: Encaminhamento ao Lucas

A IA pode reconhecer situações fora do escopo e notificar o Lucas por **WhatsApp** (mesma integração Evolution API, número configurável) com o contexto, informando o Cliente de que será encaminhado. Realiza UJ-2.

**Consequences (testable):**
- O gatilho de Fallback dispara em: assunto não-imobiliário, demanda fora dos quatro Tipos após esclarecimento, ou sinal de insatisfação/urgência que a IA não deve tratar.
- A notificação é enviada ao **número de WhatsApp do Lucas** (+55 11 98530-3959; configurável), contendo o resumo da conversa e o contato do Cliente.
- A IA informa o Cliente, com cortesia, que o Dr. Lucas dará sequência — sem prometer prazo específico [ASSUMPTION].

## 5. Não-Metas (Explícito)

- A IA **não dá orientação ou opinião jurídica** de nenhum tipo.
- Não trata cobrança, honorários ou pagamento.
- Não atende múltiplos advogados nem é multi-escritório.
- Não é CRM nem mantém histórico de relacionamento do Cliente.
- Não envia lembretes/confirmações automáticas pós-agendamento [NON-GOAL for MVP — revisitar na produção].
- Não garante robustez de produção (alta disponibilidade, volume, monitoramento) — é demo.

## 6. Escopo do MVP (POC)

### 6.1 Dentro

- Canal WhatsApp via Evolution API.
- Saudação, triagem dos 4 Tipos de Demanda e coleta conversacional de dados.
- Escolha de formato (online/presencial).
- Consulta de disponibilidade no Microsoft / Outlook Calendar via Microsoft Graph (seg-sex, 9h–18h, blocos de 1h) e oferta de Slots.
- Criação de Convite travando a Agenda, com participantes Cliente + Lucas.
- Briefing estruturado anexado ao evento.
- Fallback por WhatsApp ao Lucas.

### 6.2 Fora do MVP

- Orientação jurídica de qualquer tipo (Não-Meta permanente).
- Lembretes/reagendamento/cancelamento via IA — [NOTE FOR PM]: reagendamento é comum; revisitar se a demo for bem.
- Pagamento/honorários.
- Escolha definitiva da plataforma de agenda (Microsoft / Outlook Calendar é provisório na POC).
- Multi-advogado, CRM, dashboards.

## 7. Métricas de Sucesso

*A POC é uma demo; o sucesso é o Lucas aprovar. As métricas refletem os sinais que o convencem.*

**Primárias**
- **SM-1**: Conversa de ponta a ponta concluída (saudação → triagem → agendamento → Convite com Briefing) **sem intervenção manual**, em demo ao vivo. Valida FR-1 a FR-8.
- **SM-2**: Agendamento sem conflito — nenhum Slot oferecido/criado em horário ocupado, em todas as execuções da demo. Valida FR-5, FR-6, FR-7.

**Secundárias**
- **SM-3**: Briefing autossuficiente — o Lucas entende o caso só pelo evento, sem abrir o WhatsApp. Valida FR-8.
- **SM-4**: Conversa percebida como natural pelo Lucas (avaliação qualitativa na demo). Valida FR-1, FR-2, FR-3.

**Counter-metrics (não otimizar)**
- **SM-C1**: Naturalidade da conversa **não** pode vir ao custo de a IA opinar sobre o caso ou prometer o que não pode cumprir. Contrabalança SM-4.
- **SM-C2**: Velocidade de agendar **não** pode pular a confirmação do horário (FR-6) nem a coleta de e-mail (FR-3). Contrabalança SM-1.

## 8. Questões em Aberto

*Resolvidas na discovery (2026-06-08):*
- ~~Endereço do escritório~~ → Rua Maria Máximo 153, Ponta da Praia, Santos/SP (FR-4/FR-7).
- ~~Identidade na saudação~~ → "Escritório do Lucas" (FR-1).
- ~~Conta de agenda~~ → conta Microsoft do Felyppe, provisória na POC (§11).
- ~~Canal de Fallback~~ → WhatsApp (número do Lucas configurável), não e-mail (FR-9).
- ~~Janela de operação~~ → IA responde 24/7; agendamento só seg-sex 9h–18h (FR-1/FR-5).
- ~~Volume~~ → ~5 contatos/dia (orienta custo OpenAI na produção).

- ~~Número de WhatsApp do Lucas~~ → +55 11 98530-3959 (FR-9).

*Em aberto (resolver na arquitetura):*
1. Setup técnico da conta Microsoft (registro de app no Entra ID, credenciais OAuth, permissões Microsoft Graph para Calendar, autorização) — detalhe de arquitetura, não bloqueia o PRD.

## 9. Índice de Suposições

- §4.1 FR-1 — tempo de resposta esperado ("poucos segundos").
- §4.2 FR-5 — oferta de até 3 Slots por vez.
- §4.4 FR-9 — IA não promete prazo específico de retorno do Lucas.
- §10.2 — dados de teste / consentimento informal na demo (LGPD tratado na produção).

## 10. Restrições e Guardrails

### 10.1 Segurança (limite jurídico)
- A IA **nunca** emite orientação, opinião ou interpretação jurídica sobre o caso do Cliente. Diante de pedido de orientação, redireciona para o agendamento ou Fallback. Este é o guardrail crítico da POC — risco de responsabilidade profissional do Lucas.
- A IA se identifica como assistente automatizado; não se passa por advogado nem por humano.

### 10.2 Privacidade (LGPD)
- A conversa coleta dados pessoais (nome, telefone, e-mail, descrição do caso). Na POC o tratamento é controlado e restrito à demo; uso e retenção formais ficam para a fase de produção. [ASSUMPTION: dados de teste / consentimento informal na demo.]

### 10.3 Custo
- Inferência via OpenAI tem custo por token; na POC o volume é de demonstração. Dimensionamento de custo por contato fica para a produção (volume estimado pelo Lucas: ~5 contatos/dia).

## 11. Integrações e Dependências

- **Evolution API** — canal de envio/recebimento de mensagens no WhatsApp, incluindo a notificação de Fallback ao número do Lucas (FR-9).
- **OpenAI** — inteligência conversacional (saudação, triagem, coleta, geração do Briefing).
- **Microsoft Graph (Outlook Calendar)** — consulta de disponibilidade, criação de evento, envio de Convite, link de Teams (online). Conta Microsoft do Felyppe na POC (provisório); requer registro de app no Entra ID + permissões Microsoft Graph para Calendar (detalhe de arquitetura).
- **E-mail** — usado apenas para o envio dos Convites aos participantes (via Microsoft Graph / Outlook). O Fallback ao Lucas agora é por WhatsApp.

> Decisões de *como* integrar (webhooks, autenticação, orquestração do agente, persistência de estado da conversa) pertencem à arquitetura, não a este PRD.
