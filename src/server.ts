import express from 'express';
import { config } from './config.js';
import { handleWebhook } from './webhook/handler.js';

const app = express();
app.use(express.json({ limit: '1mb' })); // payloads da Evolution são pequenos; limite folgado

/**
 * Healthcheck — usado pelo Easypanel/Traefik e para verificação manual da story.
 */
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * Webhook da Evolution API (mensagens recebidas do WhatsApp).
 * Valida segredo → ack 200 imediato → processa o turno de forma assíncrona.
 */
app.post('/webhook', handleWebhook);

app.listen(config.port, () => {
  console.log(`[server] escutando na porta ${config.port} (env: ${config.nodeEnv})`);
});
