import { tool } from '@openai/agents';
import { z } from 'zod';
import type { TurnContext } from '../../types.js';
import { conversationRepo } from '../../repos/conversation-repo.js';
import { appointmentRepo } from '../../repos/appointment-repo.js';
import { calendar } from '../../integrations/calendar.js';
import { buildBriefing } from '../../domain/briefing.js';

/**
 * Tool: cria o agendamento do horário JÁ confirmado pelo Cliente (Story 2.5).
 * NÃO recebe data do LLM — usa `collected.selectedSlot` (gravado deterministicamente na 2.4).
 *
 * Fluxo: re-checa disponibilidade (corrida oferta↔confirmação, NFR-2) → cria evento
 * (simulado: calendar.createEvent) → persiste o `appointment` (trava o horário) → status='scheduled'.
 */
function overlaps(b: { startIso: string; endIso: string }, startMs: number, endMs: number): boolean {
  return Date.parse(b.endIso) > startMs && Date.parse(b.startIso) < endMs;
}

export const createAppointment = tool({
  name: 'createAppointment',
  description:
    'Cria o agendamento do horário JÁ confirmado pelo Cliente. Chame SOMENTE depois do "sim" explícito. ' +
    'Re-checa a disponibilidade e trava o horário. Se o horário tiver acabado de ficar indisponível, ' +
    'retorna reason "slot_taken" — nesse caso, ofereça novos horários.',
  parameters: z.object({}),
  async execute(_args, runContext) {
    const ctx = runContext?.context as TurnContext | undefined;
    if (!ctx?.conversationId) {
      return { ok: false, reason: 'contexto da conversa ausente' };
    }
    try {
      const conv = await conversationRepo.findById(ctx.conversationId);
      if (!conv) {
        return { ok: false, reason: 'conversa não encontrada' };
      }

      const slot = conv.collected.selectedSlot;
      const format = conv.meetingFormat;
      const { name, email, caseSummary } = conv.collected;

      // Guardas: precisa de slot escolhido (2.4), formato (2.2) e dados (1.6).
      if (!slot) return { ok: false, reason: 'incompleto', missing: 'selectedSlot' };
      if (!format) return { ok: false, reason: 'incompleto', missing: 'meetingFormat' };
      if (!name || !email || !caseSummary) return { ok: false, reason: 'incompleto', missing: 'dadosCliente' };

      // Re-checagem (NFR-2): a agenda da POC = calendar (simulado) ∪ appointments já marcados.
      const startMs = Date.parse(slot.startIso);
      const endMs = Date.parse(slot.endIso);
      const calBusy = await calendar.listBusy(slot.startIso, slot.endIso);
      const apptBusy = await appointmentRepo.listBookedBetween(slot.startIso, slot.endIso);
      const taken = [...calBusy, ...apptBusy].some((b) => overlaps(b, startMs, endMs));
      if (taken) {
        return { ok: false, reason: 'slot_taken' };
      }

      const briefing = buildBriefing({
        name,
        demandType: conv.demandType,
        caseSummary,
        format,
        phone: conv.phone,
        email,
      });

      // "Cria" o evento (simulado) e PERSISTE o appointment (trava o horário).
      const event = await calendar.createEvent({
        slot,
        attendees: { name, email },
        format,
        briefingText: briefing,
      });
      await appointmentRepo.add({
        conversationId: conv.id,
        startIso: slot.startIso,
        endIso: slot.endIso,
        format,
        graphEventId: event.eventId,
        joinUrl: event.joinUrl,
        location: event.location,
        briefing,
      });
      await conversationRepo.update(conv.id, { status: 'scheduled' });

      console.log(`[tool:createAppointment] agendado ${slot.label} (${format}) — conversa ${conv.id}`);
      return {
        ok: true,
        when: slot.label,
        format,
        joinUrl: event.joinUrl,
        location: event.location,
      };
    } catch (err) {
      console.error('[tool:createAppointment] falha ao agendar:', err);
      return { ok: false, reason: 'falha ao agendar' };
    }
  },
});
