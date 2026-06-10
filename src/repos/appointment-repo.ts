import { supabase } from '../integrations/supabase-client.js';
import type { Appointment } from '../types.js';

/**
 * Repositório de agendamentos. ÚNICA porta de acesso à tabela `appointments`.
 * Conversão snake_case (DB) ↔ camelCase (app) só aqui.
 */

interface AppointmentRow {
  id: string;
  conversation_id: string;
  start_at: string;
  end_at: string;
  format: Appointment['format'];
  graph_event_id: string | null;
  join_url: string | null;
  location: string | null;
  briefing: string;
  status: Appointment['status'];
  created_at: string;
}

function rowToAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    startIso: row.start_at,
    endIso: row.end_at,
    format: row.format,
    graphEventId: row.graph_event_id,
    joinUrl: row.join_url,
    location: row.location,
    briefing: row.briefing,
    status: row.status,
    createdAt: row.created_at,
  };
}

export interface AppointmentInput {
  conversationId: string;
  startIso: string;
  endIso: string;
  format: Appointment['format'];
  graphEventId: string;
  joinUrl: string | null;
  location: string | null;
  briefing: string;
}

export const appointmentRepo = {
  /** Persiste um agendamento (trava o horário). */
  async add(input: AppointmentInput): Promise<Appointment> {
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        conversation_id: input.conversationId,
        start_at: input.startIso,
        end_at: input.endIso,
        format: input.format,
        graph_event_id: input.graphEventId,
        join_url: input.joinUrl,
        location: input.location,
        briefing: input.briefing,
      })
      .select()
      .single();
    if (error) throw new Error(`[appointment-repo] add falhou: ${error.message}`);
    return rowToAppointment(data as AppointmentRow);
  },

  /**
   * Blocos `booked` que tocam o intervalo [from, to) — para descontar da oferta de slots
   * e re-checar a corrida oferta↔confirmação (NFR-2). Overlap: start < to && end > from.
   */
  async listBookedBetween(fromIso: string, toIso: string): Promise<{ startIso: string; endIso: string }[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('start_at,end_at')
      .eq('status', 'booked')
      .lt('start_at', toIso)
      .gt('end_at', fromIso);
    if (error) throw new Error(`[appointment-repo] listBookedBetween falhou: ${error.message}`);
    return (data ?? []).map((r) => ({ startIso: r.start_at as string, endIso: r.end_at as string }));
  },
};
