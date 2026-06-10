import { supabase } from '../integrations/supabase-client.js';
import type { Conversation, Message, CollectedData } from '../types.js';
import { messageRepo } from './message-repo.js';

/**
 * Repositório de conversas. ÚNICA porta de acesso à tabela `conversations`.
 * A conversão snake_case (DB) ↔ camelCase (app) acontece SÓ aqui (mappers).
 */

interface ConversationRow {
  id: string;
  phone: string;
  status: Conversation['status'];
  demand_type: Conversation['demandType'];
  meeting_format: Conversation['meetingFormat'];
  collected: Conversation['collected'];
  created_at: string;
  updated_at: string;
}

function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    phone: row.phone,
    status: row.status,
    demandType: row.demand_type,
    meetingFormat: row.meeting_format,
    collected: row.collected ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Converte um patch camelCase parcial em colunas snake_case para escrita. */
function conversationToRow(patch: Partial<Conversation>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.demandType !== undefined) row.demand_type = patch.demandType;
  if (patch.meetingFormat !== undefined) row.meeting_format = patch.meetingFormat;
  if (patch.collected !== undefined) row.collected = patch.collected;
  return row;
}

export const conversationRepo = {
  /** Cria uma conversa nova para o telefone (usa defaults do banco). */
  async create(phone: string): Promise<Conversation> {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ phone })
      .select()
      .single();
    if (error) throw new Error(`[conversation-repo] create falhou: ${error.message}`);
    return rowToConversation(data as ConversationRow);
  },

  /** Atualiza parcialmente; sempre renova updated_at (uma escrita por turno). */
  async update(id: string, patch: Partial<Conversation>): Promise<Conversation> {
    const row = { ...conversationToRow(patch), updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from('conversations')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`[conversation-repo] update falhou: ${error.message}`);
    return rowToConversation(data as ConversationRow);
  },

  /**
   * Mescla campos parciais em `collected` (read-merge-write) — NÃO sobrescreve o objeto inteiro,
   * para não perder o que já foi coletado em turnos anteriores. A serialização por telefone (1.3)
   * garante que dois turnos do mesmo Cliente não colidam nesse read-merge-write.
   */
  async updateCollected(conversationId: string, partial: CollectedData): Promise<Conversation> {
    const { data, error } = await supabase
      .from('conversations')
      .select('collected')
      .eq('id', conversationId)
      .single();
    if (error) throw new Error(`[conversation-repo] updateCollected (read) falhou: ${error.message}`);

    const current = (data?.collected ?? {}) as CollectedData;
    // Mescla só os campos definidos (ignora undefined para não apagar valores existentes).
    const merged: CollectedData = { ...current };
    for (const [k, v] of Object.entries(partial)) {
      if (v !== undefined) (merged as Record<string, unknown>)[k] = v;
    }
    return this.update(conversationId, { collected: merged });
  },

  /** Busca a conversa do telefone ou cria uma nova se não existir (usado no início do turno). */
  async getOrCreateByPhone(phone: string): Promise<Conversation> {
    const existing = await this.findByPhone(phone);
    if (existing) return existing;
    return this.create(phone);
  },

  /** Busca uma conversa pelo id (ou null se não existir). */
  async findById(id: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`[conversation-repo] findById falhou: ${error.message}`);
    return data ? rowToConversation(data as ConversationRow) : null;
  },

  /** Busca uma conversa pelo telefone (ou null se não existir). */
  async findByPhone(phone: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select()
      .eq('phone', phone)
      .maybeSingle();
    if (error) throw new Error(`[conversation-repo] findByPhone falhou: ${error.message}`);
    return data ? rowToConversation(data as ConversationRow) : null;
  },

  /**
   * Busca a conversa pelo telefone junto com as mensagens recentes (ordem cronológica).
   * Alimenta o contexto multi-turno do agente (Story 1.3+).
   */
  async findByPhoneWithMessages(
    phone: string,
    limit = 20,
  ): Promise<{ conversation: Conversation; messages: Message[] } | null> {
    const conversation = await this.findByPhone(phone);
    if (!conversation) return null;

    // Reutiliza a leitura canônica de mensagens (mesma query: recentes em ordem cronológica).
    const messages = await messageRepo.listRecent(conversation.id, limit);
    return { conversation, messages };
  },
};
