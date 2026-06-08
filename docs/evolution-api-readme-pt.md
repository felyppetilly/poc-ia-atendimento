# Evolution API

API REST open-source para WhatsApp e mensageria multicanal — parte do ecossistema Evolution Foundation.

Última versão · Licença: Apache 2.0 · Documentação · Comunidade · Imagem Docker

[Website](https://evolutionfoundation.com.br) · [Documentação](https://docs.evolutionfoundation.com.br) · [Comunidade](https://evolutionfoundation.com.br/community) · Suporte

## Sobre

A Evolution API é uma API REST poderosa e pronta para produção, voltada para WhatsApp e mensageria multicanal. Inicialmente focada no WhatsApp, ela evoluiu para uma plataforma completa que dá suporte a múltiplos provedores de mensageria e integrações.

Atualmente, a Evolution API suporta tanto a WhatsApp Web API baseada no Baileys quanto a API oficial do WhatsApp Cloud, além de integrações com Typebot, Chatwoot, Dify, OpenAI, RabbitMQ, Apache Kafka, Amazon SQS, Socket.io, Amazon S3 / MinIO e muito mais.

A Evolution API começou como uma API controladora de WhatsApp baseada no CodeChat, que por sua vez implementava a biblioteca Baileys. Continuamos reconhecendo o CodeChat por estabelecer essa base.

### Parte do ecossistema Evolution Foundation

A Evolution API é um dos motores de mensageria mantidos pela Evolution Foundation. É utilizada como provedor de WhatsApp pelo Evo CRM Community e por outros projetos do ecossistema.

## Tipos de Conexão

A Evolution API suporta múltiplos tipos de conexão com o WhatsApp:

### WhatsApp API — Baileys

Uma API gratuita baseada no WhatsApp Web, utilizando a biblioteca Baileys. Adequada para atendimentos multi-serviço, bots de atendimento e sistemas integrados ao WhatsApp. Observação: esse método depende da versão web do WhatsApp e pode ter limitações em comparação às APIs oficiais.

### WhatsApp Cloud API

A API oficial fornecida pela Meta. Projetada para empresas com maior volume de mensagens e suporte de integração mais robusto, incluindo criptografia de ponta a ponta, análises avançadas e ferramentas de atendimento ao cliente. Requer conformidade com as políticas da Meta e pode gerar custos por mensagem.

## Integrações

A Evolution API integra-se nativamente com diversas plataformas:

- **Typebot** — bots conversacionais com gerenciamento de gatilhos
- **Chatwoot** — plataforma de atendimento ao cliente
- **RabbitMQ** — streaming de eventos via AMQP
- **Apache Kafka** — streaming e processamento de eventos em tempo real
- **Amazon SQS** — fila de mensagens baseada em nuvem
- **Socket.io** — eventos WebSocket em tempo real
- **Dify** — fluxos de trabalho de agentes de IA
- **OpenAI** — capacidades de IA, incluindo conversão de áudio em texto
- **Amazon S3 / MinIO** — armazenamento de arquivos de mídia

## Início Rápido

### Pré-requisitos

- Node.js 20+
- PostgreSQL ou MySQL
- Redis (recomendado para cache)

### Instalação

```bash
git clone git@github.com:evolution-foundation/evolution-api.git
cd evolution-api

# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env
# Edite o .env com seu banco de dados, Redis e chave de API
```

### Configuração do banco de dados

```bash
# Definir o provedor do banco de dados
export DATABASE_PROVIDER=postgresql  # ou mysql

# Gerar o cliente Prisma
npm run db:generate

# Aplicar as migrations
npm run db:deploy
```

### Execução

```bash
# Desenvolvimento com hot reload
npm run dev:server

# Build e execução em produção
npm run build
npm run start:prod
```

### Docker

```bash
docker pull evoapicloud/evolution-api:latest
docker run -p 8080:8080 --env-file .env evoapicloud/evolution-api:latest
```

## Arquitetura

A Evolution API é construída sobre uma arquitetura multi-provedor e orientada a eventos:

```
Cliente / CRM
     ↓
Evolution API
  ├── Integrações de Canal (Baileys / Cloud API)
  ├── Integrações de Chatbot (Typebot, Chatwoot, OpenAI, Dify, Flowise, N8N)
  ├── Integrações de Eventos (WebSocket, RabbitMQ, SQS, NATS, Pusher)
  └── Integrações de Armazenamento (S3, MinIO)
```

Construída com Node.js 20+, TypeScript 5+ e Express.js, oferece integrações extensas com chatbots, sistemas de CRM e plataformas de mensageria.

### Suporte a múltiplos bancos de dados

PostgreSQL e MySQL via Prisma ORM, com schemas e migrations específicos por provedor.

### Autenticação

- Autenticação por chave de API via header `apikey`
- Tokens específicos por instância para autenticação da conexão com o WhatsApp
- Validação de assinatura de webhooks para integrações externas

### Suporte a fila de mensagens

RabbitMQ, Amazon SQS, NATS, Pusher e WebSocket para eventos. Configurável por instância.

### Tratamento de mídia

Armazenamento local ou S3/MinIO. Download automático de mídia do WhatsApp. Transcrição de áudio opcional via OpenAI.

## Documentação

| Recurso | Link |
|---------|------|
| Website | evolutionfoundation.com.br |
| Documentação | docs.evolutionfoundation.com.br |
| Comunidade | evolutionfoundation.com.br/community |
| Docker Hub | evoapicloud/evolution-api |
| Changelog | CHANGELOG.md |
| Contribuição | CONTRIBUTING.md |
| Segurança | SECURITY.md |

## Hospedagem

Implante a Evolution API com infraestrutura otimizada através da nossa parceria com a HostGator:

**Evolution API VPS — HostGator**

## Telemetria

A Evolution API coleta dados anônimos de telemetria (rotas utilizadas, rotas mais acessadas, versão da API) para ajudar a melhorar o serviço. Nenhum dado sensível ou pessoal é coletado. Essas informações nos ajudam a identificar melhorias e a oferecer uma melhor experiência aos usuários.

## Contribuição

Contribuições são bem-vindas! Leia o `CONTRIBUTING.md` para orientações sobre como enviar issues, propor funcionalidades e abrir pull requests.

Junte-se à nossa comunidade para discutir ideias e colaborar.

## Segurança

Para questões de segurança, não abra uma issue pública. Envie um e-mail para suporte@evofoundation.com.br ou utilize o relato privado de vulnerabilidades do GitHub. Veja o `SECURITY.md` para detalhes.

## Agradecimentos

- **CodeChat** — base original da API de WhatsApp
- **Baileys** — biblioteca de WhatsApp Web

## Licença

A Evolution API é licenciada sob a Apache License 2.0, com condições adicionais de proteção de marca (preservação de LOGO/copyright e exigência de Notificação de Uso). Veja o `LICENSE` para detalhes completos.

Para consultas sobre licenciamento, entre em contato com suporte@evofoundation.com.br.

## Marcas Registradas

"Evolution Foundation", "Evolution" e "Evolution API" são marcas registradas da Evolution Foundation. Veja o `TRADEMARKS.md` para a política de ativos de marca.

Atribuições de terceiros estão documentadas no `NOTICE`.
