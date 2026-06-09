import type { OutputGuardrail } from '@openai/agents';

/**
 * Guardrail jurídico de SAÍDA (NFR-1) — backstop.
 *
 * Defesa em profundidade:
 *  - 1ª linha (primária): a própria instrução de sistema do agente, que proíbe
 *    dar orientação/opinião/interpretação jurídica.
 *  - 2ª linha (este guardrail): heurística leve e BARATA (sem chamada de LLM extra
 *    a cada turno) que detecta sinais de conselho jurídico no texto final. Se
 *    disparar, o runner substitui a resposta por um redirecionamento seguro.
 *
 * Mantido simples de propósito (POC). Pode ser trocado depois por um classificador
 * LLM pequeno (reasoning baixo) sem mudar a interface.
 */

// Padrões que indicam conclusão/orientação jurídica afirmativa (PT-BR).
// Conservador para minimizar falso-positivo — o agente já é instruído a não opinar.
const LEGAL_ADVICE_PATTERNS: RegExp[] = [
  /\bvocê\s+(pode|deve|tem(\s+o)?\s+direito\s+de|precisa)\s+(despejar|processar|acionar|entrar\s+com|rescindir|cobrar|notificar\s+judicialmente)/i,
  /\b(é|seria)\s+(legal|ilegal|permitido|proibido|inconstitucional)\b/i,
  /\ba\s+lei\s+(permite|proíbe|exige|garante|obriga|determina|prevê)\b/i,
  /\b(você|o\s+senhor|a\s+senhora)\s+(ganha|vai\s+ganhar|perde|vai\s+perder)\s+(a\s+)?(causa|ação)\b/i,
  /\b(juridicamente|do\s+ponto\s+de\s+vista\s+jurídico|na\s+minha\s+opinião\s+jurídica)\b/i,
  /\brecomendo\s+(que\s+você\s+)?(processe|entre\s+com|acione|rescinda)\b/i,
];

function containsLegalAdvice(text: string): boolean {
  return LEGAL_ADVICE_PATTERNS.some((re) => re.test(text));
}

export const legalGuardrail: OutputGuardrail = {
  name: 'guardrail-juridico',
  async execute({ agentOutput }) {
    const text = typeof agentOutput === 'string' ? agentOutput : String(agentOutput ?? '');
    const violou = containsLegalAdvice(text);
    return {
      tripwireTriggered: violou,
      outputInfo: { violou },
    };
  },
};
