import 'dotenv/config';
import { z } from 'zod';
import { digitsOnly } from './util.js';

/**
 * Fonte ÚNICA de configuração da POC.
 * Regra da arquitetura: NUNCA acessar `process.env.X` fora deste arquivo.
 *
 * Estratégia de config incremental (ver Dev Notes da Story 1.1):
 * - Apenas o necessário para BOOTAR é obrigatório agora: PORT e NODE_ENV (ambos com default).
 * - Segredos de OpenAI / Microsoft Graph / Evolution / Supabase ficam OPCIONAIS por enquanto.
 *   Cada story futura que passar a consumir uma dessas chaves deve PROMOVÊ-LA a obrigatória
 *   aqui (remover `.optional()` / `.default()`), mantendo o fail-fast honesto.
 */
const envSchema = z.object({
  // --- Servidor (obrigatório para bootar; tem default) ---
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // --- OpenAI (OBRIGATÓRIO desde a Story 1.4 — agente) ---
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-5.5'), // slug fora do código; ajustável por env

  // --- Evolution API / WhatsApp (OBRIGATÓRIO desde a Story 1.3 — webhook + envio) ---
  EVOLUTION_BASE_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string().min(1),
  EVOLUTION_INSTANCE: z.string().min(1),
  WEBHOOK_SECRET: z.string().min(1),

  // --- Supabase (OBRIGATÓRIO desde a Story 1.2 — backend consome o banco) ---
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // --- Microsoft Graph app-only (opcional por enquanto — promovido em 2.1) ---
  TENANT_ID: z.string().optional(),
  CLIENT_ID: z.string().optional(),
  CLIENT_SECRET: z.string().optional(),
  LUCAS_USER_ID: z.string().optional(),

  // --- Regras de negócio (têm default; viram base da agenda/triagem) ---
  LUCAS_WHATSAPP: z.string().default('+5511985303959'),
  OFFICE_ADDRESS: z.string().default('Rua Maria Máximo 153, Ponta da Praia, Santos/SP'),
  BUSINESS_HOURS_START: z.coerce.number().int().min(0).max(23).default(9),
  BUSINESS_HOURS_END: z.coerce.number().int().min(1).max(24).default(18),
  MAX_SLOTS: z.coerce.number().int().positive().default(3),
  TIMEZONE: z.string().default('America/Sao_Paulo'),

  // Lista de permitidos (TESTE/DEMO): se preenchida, a IA SÓ responde a esses números
  // (separados por vírgula). Vazia = responde a todos. Protege números pessoais. Ver util.phoneAllowed.
  ALLOWED_PHONES: z.string().optional(),
}).refine((d) => d.BUSINESS_HOURS_START < d.BUSINESS_HOURS_END, {
  message: 'BUSINESS_HOURS_START deve ser menor que BUSINESS_HOURS_END (janela inválida)',
  path: ['BUSINESS_HOURS_END'],
});

// Trata variáveis vazias no .env (ex.: `OPENAI_API_KEY=`) como AUSENTES,
// para não disparar validações (.url(), etc.) em segredos ainda não preenchidos.
const rawEnv = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== ''),
);

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  console.error('[config] ❌ Configuração inválida. Corrija as variáveis de ambiente:');
  for (const issue of parsed.error.issues) {
    const campo = issue.path.join('.') || '(raiz)';
    console.error(`  - ${campo}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

/**
 * Objeto `config` tipado (camelCase) exportado como única fonte.
 */
export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,

  openaiApiKey: env.OPENAI_API_KEY,
  openaiModel: env.OPENAI_MODEL,

  evolutionBaseUrl: env.EVOLUTION_BASE_URL,
  evolutionApiKey: env.EVOLUTION_API_KEY,
  evolutionInstance: env.EVOLUTION_INSTANCE,
  webhookSecret: env.WEBHOOK_SECRET,

  supabaseUrl: env.SUPABASE_URL,
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,

  tenantId: env.TENANT_ID,
  clientId: env.CLIENT_ID,
  clientSecret: env.CLIENT_SECRET,
  lucasUserId: env.LUCAS_USER_ID,

  lucasWhatsapp: env.LUCAS_WHATSAPP,
  officeAddress: env.OFFICE_ADDRESS,
  businessHoursStart: env.BUSINESS_HOURS_START,
  businessHoursEnd: env.BUSINESS_HOURS_END,
  maxSlots: env.MAX_SLOTS,
  timezone: env.TIMEZONE,

  // Números (só dígitos) que podem falar com a IA. Vazio = todos. Protege número pessoal.
  allowedPhones: env.ALLOWED_PHONES
    ? env.ALLOWED_PHONES.split(',').map((s) => digitsOnly(s)).filter((s) => s.length > 0)
    : [],
} as const;
