import { supabase } from '../integrations/supabase-client.js';
import type { Message, MessageRole } from '../types.js';

/**
 * Repositório de mensagens. ÚNICA porta de acesso à tabela `messages`.
 * Conversão snake_case↔camelCase só aqui.
 */

interface MessageRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

/** Mapper exportado (reutilizado pelo conversation-repo). */
export function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

export const messageRepo = {
  /** Registra uma mensagem na conversa. */
  async add(input: { conversationId: string; role: MessageRole; content: string }): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: input.conversationId,
        role: input.role,
        content: input.content,
      })
      .select()
      .single();
    if (error) throw new Error(`[message-repo] add falhou: ${error.message}`);
    return rowToMessage(data as MessageRow);
  },

  /** Lista as mensagens recentes da conversa em ordem cronológica (asc) para alimentar o LLM. */
  async listRecent(conversationId: string, limit = 20): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select()
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`[message-repo] listRecent falhou: ${error.message}`);
    return (data ?? []).map(rowToMessage).reverse();
  },
};
