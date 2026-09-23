/**
 * Free-tier monthly quota: 20 invoices + 20 quotations per calendar month.
 * Counts rows created this month directly on the invoices/quotations tables —
 * no separate counter table to drift, and it resets automatically with the month.
 */
import { getSupabase } from '../supabase/client';
import { AppError, mapSupabase } from '../lib/errors';

export const FREE_MONTHLY_LIMIT = 20;

export type QuotaKind = 'invoices' | 'quotations';

function monthStartIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export async function countThisMonth(ownerId: string, kind: QuotaKind): Promise<number> {
  try {
    const { count, error } = await getSupabase()
      .from(kind)
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .gte('created_at', monthStartIso());
    if (error) throw error;
    return count ?? 0;
  } catch (e) {
    throw mapSupabase(e);
  }
}

export async function assertQuota(ownerId: string, kind: QuotaKind): Promise<void> {
  const used = await countThisMonth(ownerId, kind);
  // ponytail: check-then-insert — two racing tabs can overshoot by 1;
  // move to a DB RPC with a row lock only if that ever matters.
  if (used >= FREE_MONTHLY_LIMIT) {
    const label = kind === 'invoices' ? 'invoices' : 'quotations';
    throw AppError.quota(
      `Free limit reached: ${FREE_MONTHLY_LIMIT} ${label} this month. Contact admin for an extension — resets on the 1st.`,
    );
  }
}
