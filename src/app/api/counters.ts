/**
 * Invoice-number counter via Postgres RPC (atomic) with safe fallbacks.
 * Mirrors mobile CounterRepository. Uniqueness never depends on the
 * counter: UNIQUE(owner_id, invoice_number) + createAtomic retries on
 * 23505, so numbers can never duplicate even under concurrency.
 */
import { getSupabase } from '../supabase/client';
import { mapSupabase } from '../lib/errors';
import { formatInvoiceNumber } from './types';

/** Advisory read of the current sequence (0 when absent). */
export async function peekCounter(ownerId: string): Promise<number> {
  try {
    const { data, error } = await getSupabase()
      .from('counters')
      .select('seq')
      .eq('owner_id', ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return 0;
    const v = (data as { seq?: unknown }).seq;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    return Number.parseInt(String(v ?? ''), 10) || 0;
  } catch (e) {
    throw mapSupabase(e);
  }
}

/**
 * Next formatted number suggestion. Reserves atomically via the
 * `next_invoice_seq` RPC (migration 0002); falls back to peek+1 when the
 * RPC is missing. Prefer createAtomic for saves.
 */
export async function nextInvoiceNumber(
  ownerId: string,
  prefix: string,
): Promise<{ number: string; seq: number }> {
  try {
    const { data, error } = await getSupabase().rpc('next_invoice_seq', {
      p_owner: ownerId,
    });
    if (error) throw error;
    const seq = typeof data === 'number' ? data : Number.parseInt(String(data), 10) || 0;
    return { number: formatInvoiceNumber(prefix, seq), seq };
  } catch {
    // RPC missing (0002 not applied) or offline: best-effort fallback.
    // Authoritative safety still holds via createAtomic retries.
    const cur = await peekCounter(ownerId).catch(() => 0);
    return { number: formatInvoiceNumber(prefix, cur + 1), seq: cur + 1 };
  }
}

/**
 * Advisory best-effort bump after a successful insert. Never throws —
 * the invoice is already saved, so counter failures must not fail it.
 */
export async function bumpCounterBestEffort(ownerId: string, seq: number): Promise<void> {
  try {
    try {
      const { error } = await getSupabase().rpc('bump_counter_to', {
        p_owner: ownerId,
        p_seq: seq,
      });
      if (error) throw error;
      return;
    } catch {
      // RPC missing → plain upsert when ahead.
    }
    const cur = await peekCounter(ownerId);
    if (seq > cur) {
      await getSupabase()
        .from('counters')
        .upsert({ owner_id: ownerId, seq }, { onConflict: 'owner_id' });
    }
  } catch {
    // Counter bump skipped — never fails the save.
  }
}
