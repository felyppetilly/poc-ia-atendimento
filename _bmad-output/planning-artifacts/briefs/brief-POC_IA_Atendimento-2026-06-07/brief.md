---
title: "Product Brief: POC — IA de Pré-Atendimento WhatsApp (Advogado Imobiliário)"
status: approved
created: 2026-06-07
updated: 2026-06-07
---

# Product Brief: POC — IA de Pré-Atendimento WhatsApp (Advogado Imobiliário)

## Resumo Executivo

O Lucas é advogado imobiliário e hoje atende pessoalmente o primeiro contato de cada cliente pelo WhatsApp. Esse pré-atendimento — entender quem é a pessoa, do que ela precisa e encaixar um horário — consome tempo dele todos os dias. A alternativa natural seria contratar alguém só para esse primeiro filtro, o que vira custo fixo. Ele quer a terceira via: **economizar tempo e dinheiro automatizando o primeiro contato**.

Esta POC é um **agente de IA conectado ao WhatsApp** que faz esse pré-atendimento de ponta a ponta: saúda o cliente, pergunta no que pode ajudar, identifica o tipo de demanda imobiliária, consulta a agenda real do Lucas, marca um horário sem conflito e dispara um convite travando a agenda dos dois lados — acompanhado de um **briefing** do assunto, para o Lucas chegar à reunião já sabendo do que se trata, sem ler a conversa inteira. Quando o caso foge do escopo, a IA encaminha direto para o Lucas assumir.

O entregável é uma **demo**: o objetivo não é escalar, é provar o conceito para o Lucas. Se ele gostar, a fase seguinte constrói o produto de produção. Por isso o brief é deliberadamente enxuto e foca no que precisa funcionar de forma convincente na demonstração.

## O Problema

Cada novo cliente do Lucas começa com uma conversa repetitiva no WhatsApp: cumprimentar, descobrir se é compra, locação, regularização ou disputa, coletar o básico e achar um horário que sirva para os dois. É trabalho de baixa complexidade, mas de alta frequência, e cai sempre sobre o próprio advogado.

As consequências:

- **Tempo do advogado gasto em triagem**, não em advocacia — a parte que de fato gera receita.
- **Custo de contratar** alguém só para esse filtro inicial, difícil de justificar para um escritório enxuto.
- **Atrito de agenda**: marcar horário no vai-e-volta do chat abre espaço para dupla marcação e esquecimento.
- **Lead que esfria**: resposta lenta no primeiro contato faz o cliente procurar outro advogado.

## A Solução

Um agente conversacional no WhatsApp — sem interface própria, a "tela" é a janela de conversa que o cliente já usa. O fluxo:

1. **Saudação** — recebe o cliente de forma natural e humana, sem cara de menu/robô.
2. **Descoberta** — pergunta no que pode ajudar e identifica a qual tipo de demanda pertence: compra e venda, locação, regularização/cartório ou distrato e disputas.
3. **Agendamento** — consulta a agenda real (Google Calendar na POC), oferece apenas horários livres e marca sem gerar conflito.
4. **Convite + briefing** — dispara um invite travando a agenda dos dois lados, com um briefing do assunto para o Lucas. O briefing traz: nome do cliente, tipo de demanda, resumo do caso em 2-3 linhas e contato.
5. **Fallback** — quando o caso foge do escopo (assunto complexo, fora do horário, cliente insatisfeito), encaminha direto para o Lucas, notificando-o para assumir a conversa.

**Importante: a IA não dá orientação jurídica.** Ela tria e agenda. Opinar sobre o caso específico do cliente fica fora do escopo — decisão deliberada para evitar risco de responsabilidade profissional do advogado.

**Stack da POC:** Evolution API (canal WhatsApp), modelos OpenAI (a inteligência conversacional), Google Calendar (agenda — provisório; a escolha definitiva fica para a fase de produção).

## Por Que Essa Abordagem Convence

Não há aqui um moat tecnológico — o valor da POC está em **fazer bem duas coisas que normalmente falham**: agendar de verdade contra uma agenda real (sem dupla marcação) e entregar um briefing que poupa o Lucas de reler a conversa. Uma conversa fluida no WhatsApp é o que faz o cliente final não perceber que falou com uma IA, e é o que faz o Lucas confiar em colocar isso na frente dos clientes dele.

## Quem Isso Atende

- **Lucas (usuário-decisor)** — o advogado imobiliário. É quem aprova a POC, recebe os briefings e tem a agenda travada. Sucesso para ele: chegar à reunião preparado e não precisar contratar ninguém para o primeiro contato.
- **Cliente final (usuário da conversa)** — a pessoa que chega no WhatsApp do escritório com uma demanda imobiliária. Sucesso para ela: ser atendida na hora, de forma clara, e sair com um horário marcado. Perfil variado, pouca familiaridade com termos jurídicos — a IA precisa falar simples.

## Critérios de Sucesso (da Demo)

A POC é aprovada se, na demonstração, o Lucas reconhecer os quatro sinais:

- **Conversa natural** — o agente conduz o WhatsApp de forma fluida e humana, sem parecer menu engessado.
- **Agendamento sem conflito** — lê a agenda real, oferece só horários livres e trava o compromisso sem dupla marcação.
- **Briefing útil** — o Lucas entende do que se trata a reunião sem abrir o histórico da conversa.
- **Economia evidente** — fica claro que ele não precisa contratar alguém para o primeiro atendimento.

Sinal mensurável de apoio: uma conversa completa (saudação → agendamento → invite com briefing) concluída de ponta a ponta sem intervenção manual, em uma demo ao vivo.

## Escopo (POC)

**Dentro:**

- Canal WhatsApp via Evolution API.
- Saudação + descoberta da demanda nos 4 tipos (compra/venda, locação, regularização, distrato/disputas).
- Agendamento no Google Calendar com checagem de conflito.
- Convite para cliente e Lucas travando a agenda, com briefing do assunto.
- Fallback: encaminhar ao Lucas quando foge do escopo.

**Fora (explicitamente):**

- Orientação ou opinião jurídica de qualquer tipo.
- Cobrança/honorários ou pagamento automatizado.
- Múltiplos advogados, CRM, integrações de produção e escala.
- Escolha definitiva da plataforma de agenda (decidida na fase seguinte).
- Robustez de produção (alta disponibilidade, volume, monitoramento) — é demo.

## Riscos e Questões em Aberto

- **Sem orientação jurídica** — precisa de um limite claro na IA para nunca opinar sobre o caso (risco ético/profissional para o Lucas).
- **Horário comercial** — definir janela de atendimento e o que a IA faz fora dela.
- **LGPD** — a conversa coleta dados pessoais; na produção isso exige tratamento adequado (na POC, controlado).
- **Dependências externas** — estabilidade da Evolution API e custo por token da OpenAI ainda não dimensionados.
- **Identidade/duplicidade** — como a IA trata um cliente que já é atendido pelo Lucas, ou que volta a escrever.

## Visão

Se a demo convencer, a fase seguinte transforma a POC em produto de produção: agenda definitiva escolhida, tratamento de volume real, possivelmente múltiplos advogados/escritórios e um pré-atendimento que vira ativo comercial do escritório — o primeiro contato deixa de ser um custo e passa a ser um diferencial de atendimento.
