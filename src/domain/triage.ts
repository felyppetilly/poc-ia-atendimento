import type { DemandType } from '../types.js';

/**
 * Regra pura da triagem (sem I/O). Os 4 Tipos de Demanda do escritório.
 * Os slugs DEVEM casar com o CHECK de `conversations.demand_type` (migration 0001).
 */

export interface DemandTypeDef {
  slug: DemandType;
  label: string;
  examples: string[];
}

export const DEMAND_TYPES: readonly DemandTypeDef[] = [
  {
    slug: 'compra_venda',
    label: 'compra e venda de imóvel',
    examples: ['comprar uma casa/apartamento', 'vender um imóvel', 'contrato de compra e venda', 'sinal/entrada', 'financiamento de imóvel'],
  },
  {
    slug: 'locacao',
    label: 'locação (aluguel)',
    examples: ['alugar um imóvel', 'contrato de locação', 'reajuste de aluguel', 'rescisão de aluguel', 'garantia/fiador/caução'],
  },
  {
    slug: 'regularizacao',
    label: 'regularização / cartório',
    examples: ['escritura', 'registro de imóvel', 'inventário de imóvel', 'usucapião', 'regularização de documentação', 'partilha de bem imóvel'],
  },
  {
    slug: 'distrato',
    label: 'distrato / disputas',
    examples: ['rescindir um contrato', 'distrato', 'conflito entre as partes', 'cobrança/inadimplência em contrato imobiliário', 'disputa de posse'],
  },
] as const;

export const DEMAND_TYPE_SLUGS = DEMAND_TYPES.map((d) => d.slug) as [DemandType, ...DemandType[]];

/** Valida se um slug é um Tipo de Demanda conhecido (alinhado ao CHECK do banco). */
export function isValidDemandType(slug: string): slug is DemandType {
  return (DEMAND_TYPE_SLUGS as readonly string[]).includes(slug);
}

/**
 * Texto-guia injetado nas instruções do agente: rótulos + exemplos por tipo.
 * Mantém a "fonte da verdade" dos tipos aqui (domain), não espalhada no prompt.
 */
export const TRIAGE_GUIDE: string = DEMAND_TYPES
  .map((d) => `- ${d.slug} — ${d.label}. Ex.: ${d.examples.join('; ')}.`)
  .join('\n');
