/** User profile reads/writes (`profiles`, PK id = auth uid). */
import { getSupabase } from '../supabase/client';
import { mapSupabase } from '../lib/errors';
import { rowString, type Row } from '../lib/rows';
import { userProfileFromRow, userProfileToRow, type UserProfile } from './types';

export async function fetchProfile(uid: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await getSupabase()
      .from('profiles')
      .select()
      .eq('id', uid)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return userProfileFromRow(data as Row, uid);
  } catch (e) {
    throw mapSupabase(e);
  }
}

/** watermarkEnabled is admin-only: never written from the client. */
export async function saveProfile(
  uid: string,
  p: Omit<UserProfile, 'uid' | 'watermarkEnabled'>,
): Promise<void> {
  try {
    const { error } = await getSupabase()
      .from('profiles')
      .upsert(
        { id: uid, ...userProfileToRow(p), updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      );
    if (error) throw error;
  } catch (e) {
    throw mapSupabase(e);
  }
}

export function displayNameFromAuth(meta: Record<string, unknown>, email: string): string {
  return (
    rowString(meta['full_name'] ?? meta['name']) ||
    email
  );
}
