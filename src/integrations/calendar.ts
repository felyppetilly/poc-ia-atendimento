import { config } from '../config.js';
import type { Slot } from '../domain/datetime.js';

/**
 * Fornecedor de AGENDA — implementação SIMULADA para a POC.
 *
 * Não há Microsoft 365/Graph real (barreira de licença). Este é o ÚNICO lugar que
 * "fala com a agenda"; ele finge a parte externa: `listBusy` devolve ocupados
 * fictícios e `createEvent` gera um evento de mentira (link Teams falso/endereço)
 * sem enviar nada de verdade.
 *
 * Trocar pela agenda real depois = reescrever SÓ este arquivo, mantendo as
 * assinaturas `listBusy` / `createEvent`. As tools (2.3/2.5) e o `domain/` não
 * sabem se é simulado ou real.
 */

export interface BusyBlock {
  startIso: string;
  endIso: string;
}

export interface CreateEventInput {
  slot: Slot;
  attendees: { name?: string; email?: string };
  format: 'online' | 'presencial';
  briefingText: string;
}

export interface CreatedEvent {
  eventId: string;
  joinUrl: string | null;
  location: string | null;
}

/**
 * Ocupados fictícios para a demo (no real viraria `getSchedule`/free-busy do Graph).
 * Vazio por padrão; adicione blocos aqui para demonstrar horários indisponíveis.
 * Ex.: { startIso: '2026-06-16T10:00:00-03:00', endIso: '2026-06-16T11:00:00-03:00' }
 */
const SEED_BUSY: BusyBlock[] = [];

function overlaps(block: BusyBlock, fromMs: number, toMs: number): boolean {
  return Date.parse(block.endIso) > fromMs && Date.parse(block.startIso) < toMs;
}

export const calendar = {
  /** Blocos ocupados no intervalo (simulado: seed em memória). */
  async listBusy(fromIso: string, toIso: string): Promise<BusyBlock[]> {
    const fromMs = Date.parse(fromIso);
    const toMs = Date.parse(toIso);
    return SEED_BUSY.filter((b) => overlaps(b, fromMs, toMs));
  },

  /**
   * "Cria" o evento (simulado): gera id + link Teams falso (online) ou endereço
   * (presencial) e loga. NÃO envia e-mail/Teams reais. NÃO persiste (isso é do repo).
   */
  async createEvent(input: CreateEventInput): Promise<CreatedEvent> {
    const eventId = crypto.randomUUID();
    const joinUrl =
      input.format === 'online'
        ? `https://teams.microsoft.com/l/meetup-join/SIMULADO/${eventId}`
        : null;
    const location = input.format === 'presencial' ? config.officeAddress : null;
    console.log(
      `[calendar] (simulado) evento criado: ${eventId} (${input.format}) — convite NÃO enviado de verdade`,
    );
    return { eventId, joinUrl, location };
  },
};
