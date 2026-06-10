import { config } from '../config.js';

/**
 * Helpers de data/horário — módulo PURO (sem I/O). Toda a lógica de agenda da POC
 * vive em America/Sao_Paulo. O Brasil não tem horário de verão desde 2019, então o
 * offset é fixo -03:00 (suficiente e correto para a POC).
 *
 * A constante GRAPH_TIME_ZONE/OUTLOOK_TIMEZONE_PREFER fica preservada para uma futura
 * troca pela agenda real (Microsoft Graph), sem custo agora.
 */

export const APP_TIME_ZONE = 'America/Sao_Paulo';
/** Nome de timezone Windows que o Microsoft Graph espera (uso futuro — agenda real). */
export const GRAPH_TIME_ZONE = 'E. South America Standard Time';
/** Valor do header `Prefer` do Graph (uso futuro). */
export const OUTLOOK_TIMEZONE_PREFER = `outlook.timezone="${GRAPH_TIME_ZONE}"`;

/** Offset fixo de São Paulo (sem horário de verão desde 2019). */
const SP_OFFSET = '-03:00';

export interface Slot {
  startIso: string;
  endIso: string;
}

const WEEKDAYS_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Partes civis de "agora" no fuso de São Paulo. */
function nowInSaoPaulo(): { y: number; m: number; d: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  // hour pode vir "24" em alguns engines à meia-noite; normaliza para 0.
  const hour = Number(get('hour')) % 24;
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), hour };
}

/** Avança `days` dias civis sobre uma data de São Paulo (sem DST → soma de 24h é segura). */
function addDays(base: { y: number; m: number; d: number }, days: number): { y: number; m: number; d: number } {
  const ms = Date.parse(`${base.y}-${pad(base.m)}-${pad(base.d)}T12:00:00${SP_OFFSET}`) + days * 86_400_000;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')) };
}

/** Dia da semana (0=dom..6=sáb) de uma data civil de São Paulo. */
function weekdayOf(y: number, m: number, d: number): number {
  // Meio-dia SP (-03:00) = 15:00 UTC no mesmo dia → getUTCDay é o dia civil correto.
  return new Date(`${y}-${pad(m)}-${pad(d)}T12:00:00${SP_OFFSET}`).getUTCDay();
}

/**
 * Gera a grade de horários de atendimento: blocos de 1h, seg–sex,
 * das `config.businessHoursStart` às `config.businessHoursEnd` (9–18h por default),
 * nos próximos `days` dias úteis (default 7), em America/Sao_Paulo.
 * Pula fins de semana e horários já passados de hoje.
 */
export function generateBusinessSlots(opts?: { days?: number }): Slot[] {
  const days = opts?.days ?? 7;
  const startHour = config.businessHoursStart;
  const endHour = config.businessHoursEnd;
  const now = nowInSaoPaulo();
  const slots: Slot[] = [];

  for (let i = 0; i < days; i++) {
    const { y, m, d } = addDays({ y: now.y, m: now.m, d: now.d }, i);
    const wd = weekdayOf(y, m, d);
    if (wd === 0 || wd === 6) continue; // fim de semana fora da janela

    for (let h = startHour; h < endHour; h++) {
      if (i === 0 && h <= now.hour) continue; // não ofertar horário já passado hoje
      slots.push({
        startIso: `${y}-${pad(m)}-${pad(d)}T${pad(h)}:00:00${SP_OFFSET}`,
        endIso: `${y}-${pad(m)}-${pad(d)}T${pad(h + 1)}:00:00${SP_OFFSET}`,
      });
    }
  }
  return slots;
}

/** Rótulo de exibição em PT-BR para o WhatsApp, ex.: "seg 15/06 às 14h". */
export function formatSlotLabel(slot: Slot): string {
  const match = slot.startIso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
  if (!match) return slot.startIso;
  const [, y, mo, d, h] = match;
  const wd = weekdayOf(Number(y), Number(mo), Number(d));
  return `${WEEKDAYS_PT[wd]} ${d}/${mo} às ${Number(h)}h`;
}
