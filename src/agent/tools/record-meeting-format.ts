import { tool } from '@openai/agents';
import { z } from 'zod';
import type { TurnContext } from '../../types.js';
import { conversationRepo } from '../../repos/conversation-repo.js';

/**
 * Tool: registra o formato da reunião (online/presencial) APÓS o Cliente escolher.
 * Fronteiras: a tool ORQUESTRA; a escrita vem do `conversation-repo`. Sem SQL/regra aqui.
 * NÃO muda `status` (a conversa segue em `scheduling`; a oferta de slots é a 2.3).
 */
export const recordMeetingFormat = tool({
  name: 'recordMeetingFormat',
  description:
    'Registra o formato da reunião escolhido pelo Cliente. Chame SOMENTE depois que o Cliente escolher. ' +
    'online → o Convite terá link de videochamada (Teams); presencial → terá o endereço do escritório.',
  parameters: z.object({
    meetingFormat: z.enum(['online', 'presencial']),
  }),
  async execute({ meetingFormat }, runContext) {
    const ctx = runContext?.context as TurnContext | undefined;
    if (!ctx?.conversationId) {
      return { ok: false, reason: 'contexto da conversa ausente' };
    }
    try {
      await conversationRepo.update(ctx.conversationId, { meetingFormat });
      console.log(`[tool:recordMeetingFormat] ${meetingFormat} registrado (conversa ${ctx.conversationId})`);
      return { ok: true, meetingFormat };
    } catch (err) {
      console.error('[tool:recordMeetingFormat] falha ao persistir:', err);
      return { ok: false, reason: 'falha ao registrar' };
    }
  },
});
