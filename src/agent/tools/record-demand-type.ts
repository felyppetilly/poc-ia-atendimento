import { tool } from '@openai/agents';
import { z } from 'zod';
import type { TurnContext } from '../../types.js';
import { DEMAND_TYPE_SLUGS, isValidDemandType } from '../../domain/triage.js';
import { conversationRepo } from '../../repos/conversation-repo.js';

/**
 * Tool: registra o Tipo de Demanda APÓS o Cliente confirmar.
 * Fronteiras: a tool ORQUESTRA; a regra (slugs válidos) vem de `domain/triage`;
 * a escrita vem do `conversation-repo`. Sem SQL nem regra de negócio aqui.
 */
export const recordDemandType = tool({
  name: 'recordDemandType',
  description:
    'Registra o Tipo de Demanda do Cliente. Chame SOMENTE depois que o Cliente confirmar o entendimento. ' +
    'Tipos válidos: compra_venda, locacao, regularizacao, distrato.',
  parameters: z.object({
    demandType: z.enum(DEMAND_TYPE_SLUGS),
  }),
  async execute({ demandType }, runContext) {
    const ctx = runContext?.context as TurnContext | undefined;
    if (!ctx?.conversationId) {
      return { ok: false, reason: 'contexto da conversa ausente' };
    }
    if (!isValidDemandType(demandType)) {
      return { ok: false, reason: `tipo inválido: ${demandType}` };
    }
    try {
      // Confirmou o tipo → avança a fase para a coleta. NÃO regride o status se a
      // conversa já passou da triagem (o modelo pode re-chamar a tool em turnos seguintes).
      const current = await conversationRepo.findById(ctx.conversationId);
      const shouldAdvance = !current || current.status === 'greeting' || current.status === 'triaging';
      const patch = shouldAdvance
        ? { demandType, status: 'collecting' as const }
        : { demandType };
      await conversationRepo.update(ctx.conversationId, patch);
      console.log(`[tool:recordDemandType] ${demandType} registrado (conversa ${ctx.conversationId}, status=${shouldAdvance ? 'collecting' : current?.status})`);
      return { ok: true, demandType };
    } catch (err) {
      console.error('[tool:recordDemandType] falha ao persistir:', err);
      return { ok: false, reason: 'falha ao registrar' };
    }
  },
});
