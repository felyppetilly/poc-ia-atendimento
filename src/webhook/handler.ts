import type { Request, Response } from 'express';
import type { InboundMessage } from '../types.js';
import { config } from '../config.js';
import { digitsOnly, maskPhone } from '../util.js';
import { enqueue } from './queue.js';
import { processTurn } from './process-turn.js';

/**
 * ÚNICO módulo que conhece o formato bruto da Evolution. O resto da aplicação
 * trabalha só com `InboundMessage`.
 */

// Loga o primeiro payload bruto recebido para conferir o formato real da instância (Task 8).
let loggedRawOnce = false;

/**
 * Valida o segredo compartilhado do webhook (defense-in-depth).
 * Aceita o header `x-webhook-secret` (recomendado) OU o `apikey` do corpo da
 * Evolution — ambos comparados com `config.webhookSecret`.
 */
export function validateSecret(req: Request): boolean {
  const headerSecret = req.header('x-webhook-secret') ?? req.header('authorization');
  const bodyApikey = (req.body as { apikey?: string } | undefined)?.apikey;
  return headerSecret === config.webhookSecret || bodyApikey === config.webhookSecret;
}

interface EvolutionUpsert {
  event?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean };
    message?: { conversation?: string; extendedTextMessage?: { text?: string } };
    messageTimestamp?: number;
  };
}

/**
 * Normaliza o payload bruto da Evolution em `InboundMessage`.
 * Retorna `null` para eventos que não são mensagem de texto recebida de um Cliente.
 */
export function normalize(rawBody: unknown): InboundMessage | null {
  const body = rawBody as EvolutionUpsert;

  if (body?.event !== 'messages.upsert') return null;

  const data = body.data;
  const remoteJid = data?.key?.remoteJid;
  if (!remoteJid) return null;
  if (data?.key?.fromMe === true) return null; // eco do próprio bot — evita loop
  if (remoteJid.endsWith('@g.us')) return null; // grupo — fora de escopo

  const text = data?.message?.conversation ?? data?.message?.extendedTextMessage?.text;
  if (!text) return null; // áudio/imagem/sticker — fora de escopo nesta story

  const phone = digitsOnly(remoteJid); // remove @s.whatsapp.net e mantém só dígitos
  if (!phone) return null;

  const timestamp = data?.messageTimestamp ?? Math.floor(Date.now() / 1000);
  return { phone, text, timestamp };
}

/**
 * Handler do `POST /webhook`: valida → ack 200 imediato → normaliza → enfileira.
 * NUNCA faz `await` do processamento antes de responder 200 (evita timeout/retry da Evolution).
 */
export function handleWebhook(req: Request, res: Response): void {
  if (!validateSecret(req)) {
    console.warn('[webhook] segredo inválido — rejeitado');
    res.sendStatus(401);
    return;
  }

  // Ack imediato — o turno roda de forma assíncrona depois.
  res.sendStatus(200);

  // Loga o primeiro payload bruto APENAS fora de produção (Task 8: conferir o formato real
  // da instância). Em produção o corpo cru contém PII (telefone + texto da mensagem), então
  // fica desligado — o resto do código já mascara o telefone via maskPhone.
  if (!loggedRawOnce && config.nodeEnv !== 'production') {
    loggedRawOnce = true;
    console.log('[webhook] primeiro payload bruto recebido:', JSON.stringify(req.body));
  }

  const msg = normalize(req.body);
  if (!msg) return; // evento ignorado (não é mensagem de texto de Cliente)

  console.log(`[webhook] mensagem de ${maskPhone(msg.phone)} enfileirada`);
  enqueue(msg.phone, () => processTurn(msg));
}
