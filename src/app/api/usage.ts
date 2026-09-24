/**
 * Free-tier monthly quota: 20 invoices + 20 quotations per calendar month.
 * Counts rows created this month directly on the invoices/quotations tables —
 * no separate counter table to drift, and it resets automatically with the month.
 */
import { getSupabase } from '../supabase/client';
import { AppError, mapSupabase } from '../lib/errors';

export const FREE_MONTHLY_LIMIT = 20;

export type QuotaKind = 'invoices' | 'quotations';

/** Resolve effective limit (FREE_MONTHLY_LIMIT or per-user override from profiles). Exported for UI. */
export async function getEffectiveLimit(ownerId: string, kind: QuotaKind): Promise<number> {
  try {
    const { data } = await getSupabase()
      .from('profiles')
      .select('quota_override_invoices, quota_override_quotations')
      .eq('id', ownerId)
      .maybeSingle();
    const row = data as Record<string, unknown> | null;
    if (row) {
      const key = kind === 'invoices' ? 'quota_override_invoices' : 'quota_override_quotations';
      const v = row[key];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
      if (typeof v === 'string' && v.trim() !== '') {
        const n = parseInt(v, 10);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
  } catch {
    // ignore — use default
  }
  return FREE_MONTHLY_LIMIT;
}

function monthStartIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export async function countThisMonth(ownerId: string, kind: QuotaKind): Promise<number> {
  try {
    let q: any = getSupabase()
      .from(kind)
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .gte('created_at', monthStartIso());
    // Counts all non-cancelled (drafts + issued/paid). Cancelled free (round1 M4).
    if (typeof q.neq === 'function') q = q.neq('status', 'cancelled');
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  } catch (e) {
    throw mapSupabase(e);
  }
}

export async function assertQuota(ownerId: string, kind: QuotaKind): Promise<void> {
  const used = await countThisMonth(ownerId, kind);
  const limit = await getEffectiveLimit(ownerId, kind);
  // ponytail: check-then-insert — two racing tabs can overshoot by 1;
  // move to a DB RPC with a row lock only if that ever matters.
  if (used >= limit) {
    const label = kind === 'invoices' ? 'invoices' : 'quotations';
    throw AppError.quota(
      `Free limit reached: ${limit} ${label} this month. Contact support via Help & Support — resets on the 1st.`,
    );
  }
}
