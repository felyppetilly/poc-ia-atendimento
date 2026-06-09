-- 0001_init.sql — POC IA Atendimento
-- Estado de conversa do pré-atendimento por número de WhatsApp.
-- Escopo: conversations + messages. (appointments fica na 0002 / Story 2.5.)
-- RLS habilitado SEM policies: apenas a service role (backend) acessa.

create table conversations (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  status text not null default 'greeting'
    check (status in ('greeting','triaging','collecting','scheduling','confirming','scheduled','escalated')),
  demand_type text
    check (demand_type in ('compra_venda','locacao','regularizacao','distrato')),
  meeting_format text
    check (meeting_format in ('online','presencial')),
  collected jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx on messages (conversation_id, created_at);

-- Defense-in-depth: RLS ON, sem policies. A service role bypassa RLS;
-- qualquer chave anon/publishable fica sem acesso.
alter table conversations enable row level security;
alter table messages enable row level security;
