/**
 * PDF watermark resolution: global kill-switch AND per-user flag.
 * Both fail open (true) so today's behavior survives missing rows,
 * offline errors, or a not-yet-applied migration.
 */
import { getSupabase } from '../supabase/client';
import { fetchProfile } from './profiles';
import { mapSupabase } from '../lib/errors';
import { type Row } from '../lib/rows';

export async function fetchGlobalWatermark(): Promise<boolean> {
  try {
    const { data, error } = await getSupabase()
      .from('admin_settings')
      .select('value')
      .eq('key', 'watermark_config')
      .maybeSingle();
    if (error || !data) return true;
    const v = (data as Row)['value'] as { enabled?: unknown } | null;
    return v == null || v.enabled !== false;
  } catch {
    return true;
  }
}

export async function resolveWatermark(ownerId: string): Promise<boolean> {
  try {
    const [global, profile] = await Promise.all([
      fetchGlobalWatermark(),
      fetchProfile(ownerId),
    ]);
    return global && (profile == null || profile.watermarkEnabled !== false);
  } catch (e) {
    throw mapSupabase(e);
  }
}
