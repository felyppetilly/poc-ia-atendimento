import { config } from '../config.js';
import { generateBusinessSlots, formatSlotLabel, type Slot } from './datetime.js';
import type { OfferedSlot } from '../types.js';

/**
 * Regra de oferta de Slots — módulo PURO (sem I/O). Recebe os blocos `busy` por
 * parâmetro (de quem chama: simulado/real + appointments) e devolve até `max` slots
 * livres, priorizando a preferência de horário do Cliente.
 */

export interface BusyBlock {
  startIso: string;
  endIso: string;
}

function overlapsBusy(slot: Slot, busy: BusyBlock[]): boolean {
  const s = Date.parse(slot.startIso);
  const e = Date.parse(slot.endIso);
  return busy.some((b) => Date.parse(b.endIso) > s && Date.parse(b.startIso) < e);
}

const WD_FULL: Record<string, string[]> = {
  seg: ['segunda', 'segunda-feira'],
  ter: ['terça', 'terca', 'terça-feira', 'terca-feira'],
  qua: ['quarta', 'quarta-feira'],
  qui: ['quinta', 'quinta-feira'],
  sex: ['sexta', 'sexta-feira'],
};

/** Pontua quão bem o slot atende à preferência (texto livre). Maior = melhor. */
function preferenceScore(slot: Slot, pref?: string): number {
  if (!pref) return 0;
  const p = pref.toLowerCase();
  const hour = Number(slot.startIso.slice(11, 13));
  let score = 0;
  if (/(manh|cedo)/.test(p) && hour < 12) score += 2;
  if (/tarde/.test(p) && hour >= 12) score += 2;
  if (/(noite|fim do dia|final do dia)/.test(p) && hour >= 17) score += 1;

  const abbr = formatSlotLabel(slot).slice(0, 3); // "seg", "ter", ...
  if (p.includes(abbr) || (WD_FULL[abbr]?.some((name) => p.includes(name)) ?? false)) {
    score += 3;
  }
  return score;
}

/**
 * Gera os slots a ofertar: parte da grade de atendimento, remove o que colide com
 * `busy`, prioriza a preferência (desempate cronológico) e corta em `max`.
 */
export function generateSlots(input: {
  busy: BusyBlock[];
  timePreference?: string;
  max?: number;
  days?: number;
}): OfferedSlot[] {
  const max = input.max ?? config.maxSlots;
  const grid = generateBusinessSlots({ days: input.days ?? 7 });
  const free = grid.filter((s) => !overlapsBusy(s, input.busy));

  const ranked = free
    .map((s, idx) => ({ s, idx, score: preferenceScore(s, input.timePreference) }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx);

  return ranked.slice(0, max).map(({ s }) => ({
    startIso: s.startIso,
    endIso: s.endIso,
    label: formatSlotLabel(s),
  }));
}
