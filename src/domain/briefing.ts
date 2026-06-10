import { DEMAND_TYPES } from './triage.js';
import type { DemandType, MeetingFormat } from '../types.js';

/**
 * Montagem do Briefing (FR-8) — módulo PURO (sem I/O). Texto estruturado que vai no
 * corpo do evento (na POC, no `appointment` persistido), legível sem abrir o WhatsApp.
 */

function demandLabel(slug: DemandType | null): string {
  if (!slug) return 'não classificado';
  return DEMAND_TYPES.find((d) => d.slug === slug)?.label ?? slug;
}

export interface BriefingInput {
  name?: string;
  demandType: DemandType | null;
  caseSummary?: string;
  format: MeetingFormat;
  phone: string;
  email?: string;
}

export function buildBriefing(input: BriefingInput): string {
  const contato = `tel ${input.phone}${input.email ? ` · e-mail ${input.email}` : ''}`;
  return [
    'BRIEFING — Pré-atendimento (IA)',
    `Cliente: ${input.name ?? '—'}`,
    `Tipo de demanda: ${demandLabel(input.demandType)}`,
    `Formato: ${input.format === 'online' ? 'Online (videochamada)' : 'Presencial'}`,
    `Contato: ${contato}`,
    `Resumo do caso: ${input.caseSummary ?? '—'}`,
  ].join('\n');
}
