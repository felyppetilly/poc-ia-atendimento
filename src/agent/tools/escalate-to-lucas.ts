import { tool } from '@openai/agents';
import { z } from 'zod';
import type { TurnContext } from '../../types.js';
import { config } from '../../config.js';
import { conversationRepo } from '../../repos/conversation-repo.js';
import { evolutionClient } from '../../integrations/evolution-client.js';
import { maskPhone } from '../../util.js';

/**
 * Tool de Fallback (FR-9 / UJ-2): notifica o Dr. Lucas no WhatsApp e marca a conversa
 * como `escalated`. É o SEGUNDO caminho de envio da Evolution (o 1º é a resposta ao Cliente).
 *
 * Fronteiras: a tool ORQUESTRA — lê o estado via `conversation-repo`, envia via
 * `evolution-client`, grava `status` via repo. Sem SQL solto, sem `process.env`, texto puro.
 *
 * O contato do Cliente (nome/telefone/e-mail/tipo) é puxado do ESTADO da conversa, não
 * apenas do que a IA passa (a IA passa só o `summary`).
 */
export const escalateToLucas = tool({
  name: 'escalateToLucas',
  description:
    'Encaminha a conversa ao Dr. Lucas (Fallback). Acione quando: (1) o assunto não for imobiliário; ' +
    '(2) a demanda não se enquadrar nos 4 tipos após uma tentativa de esclarecimento; ou (3) houver sinal ' +
    'de insatisfação/urgência que você não deve tratar (ex.: pedido explícito de falar com um humano). ' +
    'Gere um resumo objetivo da conversa em `summary`. NÃO acione duas vezes na mesma conversa.',
  parameters: z.object({
    summary: z.string().describe('Resumo objetivo da conversa para o Dr. Lucas.'),
    reason: z.string().nullish().describe('Gatilho do encaminhamento (ex.: "assunto não-imobiliário").'),
  }),
  async execute({ summary, reason }, runContext) {
    const ctx = runContext?.context as TurnContext | undefined;
    if (!ctx?.conversationId) {
      return { ok: false, reason: 'contexto da conversa ausente' };
    }

    const conv = await conversationRepo.findById(ctx.conversationId);
    if (!conv) {
      return { ok: false, reason: 'conversa não encontrada' };
    }

    // Idempotência: se já foi encaminhada, NÃO notifica o Lucas de novo (evita spam).
    if (conv.status === 'escalated') {
      console.log(`[tool:escalateToLucas] conversa ${ctx.conversationId} já estava escalated — sem reenvio`);
      return { ok: true, alreadyEscalated: true };
    }

    // Contato puxado do estado da conversa (não confiar só no que a IA passa).
    const nome = conv.collected.name ?? '—';
    const email = conv.collected.email ?? '—';
    const tipo = conv.demandType ?? 'fora de escopo';
    const mensagem =
      `🔔 Encaminhamento (IA Pré-atendimento)\n` +
      `Cliente: ${nome}\n` +
      `Telefone: ${conv.phone}\n` +
      `E-mail: ${email}\n` +
      `Tipo: ${tipo}\n` +
      `Motivo: ${reason ?? 'fallback'}\n` +
      `Resumo: ${summary}`;

    try {
      await evolutionClient.sendText(config.lucasWhatsapp, mensagem);
    } catch (err) {
      // Falha ao notificar o Lucas não vaza ao Cliente; não marca escalated (permite nova tentativa).
      console.error(`[tool:escalateToLucas] falha ao notificar o Lucas (${maskPhone(config.lucasWhatsapp)}):`, err);
      return { ok: false, reason: 'falha ao notificar' };
    }

    await conversationRepo.update(ctx.conversationId, { status: 'escalated' });
    console.log(`[tool:escalateToLucas] notificado o Lucas e conversa ${ctx.conversationId} marcada escalated — motivo: ${reason ?? 'fallback'}`);
    return { ok: true };
  },
});
