/**
 * Account deletion: DPDP-act compliant self-erase of app data.
 * Mirrors mobile AccountDeletionService.
 *
 * Order matters: app tables first (while still authenticated), then sign
 * out. There is NO client-side auth-user delete — removing the auth user
 * itself requires the service_role key (dashboard or Edge Function).
 * Table deletes are RLS-owner-scoped; invoices cascade to invoice_events.
 */
import { getSupabase } from '../supabase/client';
import { AppError, mapSupabase } from '../lib/errors';
import { rowString, type Row } from '../lib/rows';

async function deleteAllFrom(table: 'invoices' | 'clients' | 'products', uid: string) {
  // Paginated deletes (PostgREST caps rows per request).
  for (;;) {
    const { data, error } = await getSupabase()
      .from(table)
      .select('id')
      .eq('owner_id', uid)
      .limit(400);
    if (error) throw error;
    const rows = (Array.isArray(data) ? data : []) as Row[];
    if (rows.length === 0) return;
    for (const r of rows) {
      try {
        await getSupabase().from(table).delete().eq('id', rowString(r['id']));
      } catch {
        // best-effort per row
      }
    }
    if (rows.length < 400) return;
  }
}

/** Wipe user data → sign out. Throws AppError with user-safe messages. */
export async function deleteAccountAndData(): Promise<void> {
  const db = getSupabase();
  const { data: sessionData } = await db.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) throw AppError.validation('Not signed in.');

  try {
    // Child events first (explicit ordering even though invoices cascade).
    try {
      const { data } = await db
        .from('invoice_events')
        .select('id, invoices!inner(owner_id)')
        .eq('invoices.owner_id', uid)
        .limit(1000);
      for (const e of (Array.isArray(data) ? data : []) as Row[]) {
        try {
          await db.from('invoice_events').delete().eq('id', rowString(e['id']));
        } catch {
          // best-effort
        }
      }
    } catch {
      // best-effort
    }

    for (const table of ['invoices', 'quotations', 'clients', 'products'] as const) {
      await deleteAllFrom(table as any, uid);
    }
    // Single rows (counters keyed by owner_id; companies/profiles by id).
    for (const t of ['counters', 'companies', 'profiles'] as const) {
      try {
        await db
          .from(t)
          .delete()
          .eq(t === 'counters' ? 'owner_id' : 'id', uid);
      } catch {
        // best-effort
      }
    }
  } catch (e) {
    throw mapSupabase(e);
  }

  try {
    await db.auth.signOut();
  } catch (e) {
    throw mapSupabase(e);
  }
}
