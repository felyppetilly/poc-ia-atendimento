import { config } from '../config.js';
import { digitsOnly, maskPhone } from '../util.js';

/**
 * Cliente da Evolution API (envio de mensagens WhatsApp).
 * Usa fetch nativo (Node 24) — sem dependência HTTP extra.
 */
export const evolutionClient = {
  /**
   * Envia uma mensagem de texto para o número via Evolution.
   * `phone` é normalizado para só dígitos. Erros são logados e relançados de
   * forma controlada (o chamador decide; não derruba o processo).
   */
  async sendText(phone: string, text: string): Promise<void> {
    const number = digitsOnly(phone);
    // encodeURIComponent: o nome da instância pode ter espaços (ex.: "Whatsapp - Felyppe").
    const url = `${config.evolutionBaseUrl}/message/sendText/${encodeURIComponent(config.evolutionInstance)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: config.evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ number, text }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText} ${detail}`.trim());
      }
      console.log(`[evolution] enviado para ${maskPhone(phone)}`);
    } catch (err) {
      console.error(`[evolution] falha ao enviar para ${maskPhone(phone)}:`, err);
      throw err;
    }
  },
};
