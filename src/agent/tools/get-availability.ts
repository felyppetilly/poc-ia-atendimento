import { tool } from '@openai/agents';
import { z } from 'zod';
import type { TurnContext } from '../../types.js';
import { config } from '../../config.js';
import { conversationRepo } from '../../repos/conversation-repo.js';
import { appointmentRepo } from '../../repos/appointment-repo.js';
import { calendar } from '../../integrations/calendar.js';
import { generateBusinessSlots } from '../../domain/datetime.js';
import { generateSlots } from '../../domain/slots.js';

/**
 * Tool: consulta a agenda (simulada) e oferta até `config.maxSlots` horários livres,
 * priorizando a preferência do Cliente. Persiste os slots ofertados em
 * `collected.offeredSlots` para a confirmação (2.4) mapear "opção N" → slot real.
 *
 * Fronteiras: a tool ORQUESTRA (calendar + repo); a REGRA vive em `domain/slots.ts`.
 */
export const getAvailability = tool({
  name: 'getAvailability',
  description:
    'Consulta a agenda do Dr. Lucas e devolve os horários livres (seg–sex, 9h–18h, blocos de 1h), ' +
    'no máximo 3, priorizando a preferência de horário do Cliente. Chame depois que o formato for escolhido. ' +
    'Apresente os horários ao Cliente como uma lista numerada (1), 2), 3)) em texto puro.',
  parameters: z.object({
    timePreference: z.string().nullish().describe('Preferência de horário do Cliente, se houver (ex.: "de manhã").'),
  }),
  async execute({ timePreference }, runContext) {
    const ctx = runContext?.context as TurnContext | undefined;
    if (!ctx?.conversationId) {
      return { ok: false, reason: 'contexto da conversa ausente' };
    }
    try {
      const grid = generateBusinessSlots({ days: 7 });
      if (grid.length === 0) {
        return { ok: false, reason: 'sem horários na janela comercial' };
      }
      const fromIso = grid[0].startIso;
      const toIso = grid[grid.length - 1].endIso;

      // A "agenda" da POC = calendar simulado ∪ appointments já marcados (trava NFR-2).
      const [calBusy, apptBusy] = await Promise.all([
        calendar.listBusy(fromIso, toIso),
        appointmentRepo.listBookedBetween(fromIso, toIso),
      ]);
      const busy = [...calBusy, ...apptBusy];

      // Preferência: a passada pela IA OU a coletada no estado (1.6).
      const conv = await conversationRepo.findById(ctx.conversationId);
      const pref = timePreference ?? conv?.collected.timePreference;

      const slots = generateSlots({ busy, timePreference: pref ?? undefined, max: config.maxSlots, days: 7 });
      if (slots.length === 0) {
        return { ok: false, reason: 'sem horários livres' };
      }

      // Persistir os ofertados p/ a confirmação (2.4) mapear índice → slot real.
      await conversationRepo.updateCollected(ctx.conversationId, { offeredSlots: slots });
      console.log(`[tool:getAvailability] ofertados ${slots.length} slots (conversa ${ctx.conversationId})`);

      return { ok: true, slots: slots.map((s, i) => ({ index: i + 1, label: s.label })) };
    } catch (err) {
      console.error('[tool:getAvailability] falha ao consultar agenda:', err);
      return { ok: false, reason: 'falha ao consultar agenda' };
    }
  },
});
