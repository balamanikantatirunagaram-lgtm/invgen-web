/** CompanySettings CRUD (`companies` row keyed by owner id). */
import { getSupabase } from '../supabase/client';
import { mapSupabase } from '../lib/errors';
import type { Row } from '../lib/rows';
import { companyFromRow, companyToRow, type CompanySettings } from './types';

export async function fetchCompany(uid: string): Promise<CompanySettings | null> {
  try {
    const { data, error } = await getSupabase()
      .from('companies')
      .select()
      .eq('id', uid)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return companyFromRow(data as Row, uid);
  } catch (e) {
    throw mapSupabase(e);
  }
}

export async function saveCompany(
  uid: string,
  c: Omit<CompanySettings, 'id' | 'updatedAt'>,
): Promise<void> {
  try {
    const { error } = await getSupabase()
      .from('companies')
      .upsert(
        { id: uid, ...companyToRow(c), updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      );
    if (error) throw error;
  } catch (e) {
    throw mapSupabase(e);
  }
}
