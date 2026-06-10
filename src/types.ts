/**
 * Tipos compartilhados do domínio (camelCase).
 * Espelham os CHECKs do banco (snake_case) — a conversão fica só na camada repo.
 */

export type ConversationStatus =
  | 'greeting'
  | 'triaging'
  | 'collecting'
  | 'scheduling'
  | 'confirming'
  | 'scheduled'
  | 'escalated';

export type DemandType =
  | 'compra_venda'
  | 'locacao'
  | 'regularizacao'
  | 'distrato';

export type MeetingFormat = 'online' | 'presencial';

export type MessageRole = 'user' | 'assistant' | 'system';

/** Um horário ofertado/escolhido (gravado em `collected` para sobreviver entre turnos). */
export interface OfferedSlot {
  startIso: string;
  endIso: string;
  label: string;
}

/** Dados coletados do cliente ao longo da conversa (jsonb flexível — preenchido na Story 1.6+). */
export interface CollectedData {
  name?: string;
  email?: string;
  caseSummary?: string;
  timePreference?: string;
  /** Slots ofertados na última chamada de getAvailability (Story 2.3). */
  offeredSlots?: OfferedSlot[];
  /** Slot escolhido e em confirmação (Story 2.4). */
  selectedSlot?: OfferedSlot;
}

/** Alias para os dados coletados (terminologia da Story 1.6). */
export type Collected = CollectedData;

export interface Conversation {
  id: string;
  phone: string;
  status: ConversationStatus;
  demandType: DemandType | null;
  meetingFormat: MeetingFormat | null;
  collected: CollectedData;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

/** Agendamento criado a partir da conversa (Story 2.5; na POC a agenda é simulada). */
export interface Appointment {
  id: string;
  conversationId: string;
  startIso: string;
  endIso: string;
  format: MeetingFormat;
  graphEventId: string | null;
  joinUrl: string | null;
  location: string | null;
  briefing: string;
  status: 'booked' | 'cancelled';
  createdAt: string;
}

/** Mensagem de entrada normalizada a partir do payload bruto da Evolution (só o handler conhece o formato cru). */
export interface InboundMessage {
  phone: string;
  text: string;
  timestamp: number;
}

/** Contexto do turno passado ao `run` do agente — permite que as tools saibam qual conversa atualizar. */
export interface TurnContext {
  conversationId: string;
  phone: string;
}
