-- 0002_appointments.sql — POC IA Atendimento (Épico 2)
-- Agendamentos criados a partir da conversa. Na POC a agenda é simulada, então esta
-- tabela é a FONTE DA VERDADE da trava (NFR-2): um slot marcado deixa de ser ofertável.
-- RLS habilitado SEM policies: apenas a service role (backend) acessa.

create table appointments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  format text not null check (format in ('online','presencial')),
  graph_event_id text,            -- na POC = id do evento simulado (uuid)
  join_url text,                  -- online: link de videochamada (Teams, simulado)
  location text,                  -- presencial: endereço do escritório
  briefing text not null,         -- briefing estruturado (FR-8)
  status text not null default 'booked'
    check (status in ('booked','cancelled')),
  created_at timestamptz not null default now()
);

create index appointments_conversation_idx on appointments (conversation_id);
create index appointments_start_end_idx on appointments (start_at, end_at);

alter table appointments enable row level security;
