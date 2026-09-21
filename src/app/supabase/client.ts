import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when backend env keys are present. Guards render login vs setup notice. */
export const isBackendConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** Shared Supabase client (same project as the mobile app). Throws if unconfigured. */
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env.local and set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
    );
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
