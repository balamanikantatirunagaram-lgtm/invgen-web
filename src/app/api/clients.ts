/** Client CRUD + search. Mirrors mobile ClientRepository (ilike search). */
import { getSupabase } from '../supabase/client';
import { mapSupabase, isUniqueViolation } from '../lib/errors';
import { rowString, type Row } from '../lib/rows';
import { clientFromRow, clientToRow, type Client } from './types';

/** Escape PostgREST ilike wildcards so %/_ in user input are literal. */
function escapeLike(q: string): string {
  return q
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/,/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '');
}

function toClients(rows: unknown): Client[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Row[]).map((m) => clientFromRow(m, rowString(m['id'])));
}

export async function fetchClients(ownerId: string): Promise<Client[]> {
  try {
    const { data, error } = await getSupabase()
      .from('clients')
      .select()
      .eq('owner_id', ownerId)
      .order('business_name');
    if (error) throw error;
    return toClients(data);
  } catch (e) {
    throw mapSupabase(e);
  }
}

export async function searchClients(
  ownerId: string,
  query: string,
  limit = 20,
): Promise<Client[]> {
  try {
    const q = query.trim();
    let req = getSupabase().from('clients').select().eq('owner_id', ownerId);
    if (q !== '') {
      const like = `%${escapeLike(q)}%`;
      req = req.or(`business_name.ilike.${like},gstin.ilike.${like},mobile.ilike.${like}`);
    }
    const { data, error } = await req.order('business_name').limit(limit);
    if (error) throw error;
    return toClients(data);
  } catch (e) {
    throw mapSupabase(e);
  }
}

export async function createClient(c: Omit<Client, 'id'>, draftId: string): Promise<string> {
  try {
    const { data, error } = await getSupabase()
      .from('clients')
      .insert({ ...clientToRow(c), id: draftId })
      .select('id')
      .single();
    if (error) throw error;
    return rowString((data as Row)['id']);
  } catch (e) {
    if (isUniqueViolation(e)) {
      try {
        const { data } = await getSupabase()
          .from('clients')
          .select('id')
          .eq('id', draftId)
          .maybeSingle();
        if (data) return draftId;
      } catch {}
    }
    throw mapSupabase(e);
  }
}

export async function updateClient(c: Client): Promise<void> {
  try {
    const { id, ...rest } = c;
    const { error } = await getSupabase()
      .from('clients')
      .update(clientToRow({ ...rest, ownerId: c.ownerId }))
      .eq('id', id);
    if (error) throw error;
  } catch (e) {
    throw mapSupabase(e);
  }
}

export async function deleteClient(id: string): Promise<void> {
  try {
    const { error } = await getSupabase().from('clients').delete().eq('id', id);
    if (error) throw error;
  } catch (e) {
    throw mapSupabase(e);
  }
}
