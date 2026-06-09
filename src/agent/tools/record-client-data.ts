import { tool } from '@openai/agents';
import { z } from 'zod';
import type { TurnContext, CollectedData } from '../../types.js';
import { conversationRepo } from '../../repos/conversation-repo.js';

/**
 * Tool: registra os dados do Cliente de forma INCREMENTAL durante a coleta.
 * Fronteiras: tool orquestra; validação (e-mail/zod) é regra simples aqui;
 * persistência (merge) via `conversation-repo.updateCollected`.
 *
 * Gate (AC2): só transiciona para `scheduling` quando nome + e-mail + resumo
 * estiverem presentes. A preferência de horário é registrada mas não bloqueia.
 */
export const recordClientData = tool({
  name: 'recordClientData',
  description:
    'Registra os dados do Cliente coletados na conversa (pode ser parcial/incremental): ' +
    'nome completo, e-mail, resumo do caso e preferência de horário. ' +
    'Chame conforme as informações forem surgindo. NÃO peça o telefone (já temos pelo WhatsApp).',
  parameters: z.object({
    name: z.string().nullish(),
    email: z.string().nullish(),
    caseSummary: z.string().nullish(),
    timePreference: z.string().nullish(),
  }),
  async execute({ name, email, caseSummary, timePreference }, runContext) {
    const ctx = runContext?.context as TurnContext | undefined;
    if (!ctx?.conversationId) {
      return { ok: false, reason: 'contexto da conversa ausente' };
    }

    // Validação de e-mail AQUI (não no schema) para a IA poder re-perguntar com gentileza.
    if (email != null && email.trim() !== '') {
      const parsed = z.email().safeParse(email.trim());
      if (!parsed.success) {
        return { ok: false, reason: 'invalid_email' };
      }
    }

    const partial: CollectedData = {};
    if (name != null && name.trim() !== '') partial.name = name.trim();
    if (email != null && email.trim() !== '') partial.email = email.trim();
    if (caseSummary != null && caseSummary.trim() !== '') partial.caseSummary = caseSummary.trim();
    if (timePreference != null && timePreference.trim() !== '') partial.timePreference = timePreference.trim();

    try {
      const updated = await conversationRepo.updateCollected(ctx.conversationId, partial);
      const c = updated.collected;

      // Gate: o que ainda falta para liberar o agendamento (nome + e-mail + resumo).
      const missing: string[] = [];
      if (!c.name) missing.push('name');
      if (!c.email) missing.push('email');
      if (!c.caseSummary) missing.push('caseSummary');

      if (missing.length === 0 && updated.status !== 'scheduling') {
        await conversationRepo.update(ctx.conversationId, { status: 'scheduling' });
      }

      console.log(`[tool:recordClientData] conversa ${ctx.conversationId} — faltam: ${missing.join(',') || 'nada'}`);
      return { ok: true, missing, readyForScheduling: missing.length === 0 };
    } catch (err) {
      console.error('[tool:recordClientData] falha ao persistir:', err);
      return { ok: false, reason: 'falha ao registrar' };
    }
  },
});
