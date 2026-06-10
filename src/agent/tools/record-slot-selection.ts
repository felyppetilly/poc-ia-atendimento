import { tool } from '@openai/agents';
import { z } from 'zod';
import type { TurnContext } from '../../types.js';
import { conversationRepo } from '../../repos/conversation-repo.js';

/**
 * Tool: registra o horário escolhido pelo Cliente a partir do NÚMERO da lista
 * oferecida (1, 2, 3). Mapeia o índice → `collected.offeredSlots[index-1]` de forma
 * DETERMINÍSTICA (não confia no LLM para copiar a data/hora), grava `selectedSlot` e
 * move a conversa para `status='confirming'`. NÃO cria o evento (isso é a 2.5, só após o "sim").
 */
export const recordSlotSelection = tool({
  name: 'recordSlotSelection',
  description:
    'Registra o horário escolhido pelo Cliente a partir do NÚMERO da lista oferecida (ex.: 1, 2 ou 3). ' +
    'Chame assim que o Cliente indicar qual horário quer, ANTES de pedir a confirmação final. ' +
    'Depois de chamar, repita data, hora e formato e peça a confirmação explícita do Cliente.',
  parameters: z.object({
    index: z.number().int().positive().describe('O número do horário escolhido, conforme a lista oferecida.'),
  }),
  async execute({ index }, runContext) {
    const ctx = runContext?.context as TurnContext | undefined;
    if (!ctx?.conversationId) {
      return { ok: false, reason: 'contexto da conversa ausente' };
    }
    try {
      const conv = await conversationRepo.findById(ctx.conversationId);
      const offered = conv?.collected.offeredSlots ?? [];
      const slot = offered[index - 1];
      if (!slot) {
        // Índice fora da lista atual — a IA deve reofertar (getAvailability) ou pedir de novo.
        return { ok: false, reason: 'indice_invalido', offeredCount: offered.length };
      }
      await conversationRepo.updateCollected(ctx.conversationId, { selectedSlot: slot });
      await conversationRepo.update(ctx.conversationId, { status: 'confirming' });
      console.log(`[tool:recordSlotSelection] slot ${index} (${slot.label}) selecionado (conversa ${ctx.conversationId})`);
      return { ok: true, selected: { label: slot.label } };
    } catch (err) {
      console.error('[tool:recordSlotSelection] falha ao registrar seleção:', err);
      return { ok: false, reason: 'falha ao registrar' };
    }
  },
});
