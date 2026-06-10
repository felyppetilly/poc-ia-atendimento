import type { InboundMessage } from '../types.js';
import { conversationRepo } from '../repos/conversation-repo.js';
import { messageRepo } from '../repos/message-repo.js';
import { evolutionClient } from '../integrations/evolution-client.js';
import { runTurn } from '../agent/runner.js';
import { maskPhone } from '../util.js';

/** Resposta cordial de fallback se o agente/OpenAI falhar (sem vazar erro técnico ao Cliente). */
const ERROR_FALLBACK =
  'Tive uma pequena instabilidade aqui 😅 Pode me mandar a mensagem de novo em instantes? Já vou te responder.';

/**
 * Processa um turno de conversa (round-trip completo). Roda de forma assíncrona,
 * fora do ciclo request/response do webhook, serializado por telefone pela fila.
 *
 * Story 1.4: o gerador de resposta agora é o agente (runner), que substituiu o
 * placeholder da 1.3.
 */
export async function processTurn(msg: InboundMessage): Promise<void> {
  const { phone, text } = msg;
  console.log(`[webhook] processando turno de ${maskPhone(phone)}`);

  const conversation = await conversationRepo.getOrCreateByPhone(phone);
  await messageRepo.add({ conversationId: conversation.id, role: 'user', content: text });

  let reply: string;
  try {
    reply = await runTurn(phone, text);
  } catch (err) {
    console.error(`[webhook] agente falhou para ${maskPhone(phone)}:`, err);
    reply = ERROR_FALLBACK;
  }

  // Envia ao WhatsApp e SÓ então persiste a resposta (AC3 da 1.3: persistir os dois lados).
  // Persistimos só o que foi REALMENTE entregue: se o envio falhar, não gravamos a resposta
  // (mantém o histórico fiel ao que o Cliente viu). Se a gravação falhar APÓS o envio, logamos
  // o dessync explicitamente em vez de deixar a fila engolir o erro de forma genérica.
  try {
    await evolutionClient.sendText(phone, reply);
  } catch (err) {
    console.error(`[webhook] falha ao ENVIAR resposta para ${maskPhone(phone)} (resposta não persistida):`, err);
    return;
  }
  try {
    await messageRepo.add({ conversationId: conversation.id, role: 'assistant', content: reply });
  } catch (err) {
    console.error(`[webhook] resposta ENVIADA mas NÃO persistida para ${maskPhone(phone)} — histórico dessincronizado:`, err);
  }
}
