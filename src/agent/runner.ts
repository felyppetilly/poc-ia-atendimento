import { run, withTrace, OutputGuardrailTripwireTriggered } from '@openai/agents';
import type { AgentInputItem } from '@openai/agents';
import { preAtendimentoAgent } from './pre-atendimento.js';
import { conversationRepo } from '../repos/conversation-repo.js';
import type { Message, TurnContext } from '../types.js';
import { maskPhone } from '../util.js';

/**
 * Resposta segura de redirecionamento usada quando o guardrail jurídico dispara.
 */
const SAFE_REDIRECT =
  'Essa é uma pergunta importante pro Dr. Lucas — eu não consigo dar orientação jurídica por aqui, ' +
  'mas posso te ajudar a agendar uma conversa com ele pra esclarecer isso direitinho. Quer que eu veja um horário? 🙂';

/**
 * Converte as mensagens persistidas (ordem cronológica) em input items do Agents SDK.
 * - user  → item simples com content string
 * - assistant → item com status 'completed' e content como output_text
 * (system não é persistido na POC; a instrução de sistema vive no agente.)
 */
function toInputItems(messages: Message[]): AgentInputItem[] {
  return messages.map((m): AgentInputItem =>
    m.role === 'assistant'
      ? { role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: m.content }] }
      : { role: 'user', content: m.content },
  );
}

/**
 * Roda um turno do agente: carrega o histórico do telefone (que JÁ inclui a mensagem
 * atual do Cliente, persistida antes em processTurn), roda o agente e devolve o texto.
 * Trata o tripwire do guardrail jurídico, substituindo por um redirecionamento seguro.
 *
 * A persistência da resposta e o envio ao WhatsApp continuam em processTurn (como na 1.3).
 */
export async function runTurn(phone: string, inboundText: string): Promise<string> {
  const loaded = await conversationRepo.findByPhoneWithMessages(phone);
  // Garante o id da conversa para o context das tools (processTurn já criou/persistiu).
  const conversation = loaded?.conversation ?? (await conversationRepo.getOrCreateByPhone(phone));
  // O histórico já termina na última mensagem do Cliente — não reanexar inboundText.
  const input: AgentInputItem[] =
    loaded && loaded.messages.length > 0
      ? toInputItems(loaded.messages)
      : [{ role: 'user', content: inboundText }];

  // Contexto do turno: permite às tools (recordDemandType/escalateToLucas) saber qual conversa atualizar.
  const context: TurnContext = { conversationId: conversation.id, phone };

  try {
    const result = await withTrace('pre-atendimento', () => run(preAtendimentoAgent, input, { context }));
    const reply = (result.finalOutput ?? '').toString().trim();
    return reply || SAFE_REDIRECT;
  } catch (err) {
    if (err instanceof OutputGuardrailTripwireTriggered) {
      console.warn(`[agent] guardrail jurídico disparou para ${maskPhone(phone)} — redirecionando`);
      return SAFE_REDIRECT;
    }
    throw err; // erros de OpenAI sobem para processTurn tratar com cortesia
  }
}
