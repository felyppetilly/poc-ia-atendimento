import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/**
 * Client Supabase server-only — usa a SERVICE ROLE key (bypassa RLS).
 * ÚNICO lugar que instancia o client. Nada fora de `repos/` deve importá-lo.
 *
 * persistSession/autoRefreshToken = false: é um serviço sem usuário logado.
 */
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
