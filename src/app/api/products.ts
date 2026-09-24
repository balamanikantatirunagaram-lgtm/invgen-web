/** Product catalog CRUD. Mirrors mobile ProductRepository. */
import { getSupabase } from '../supabase/client';
import { mapSupabase, isUniqueViolation } from '../lib/errors';
import { rowString, type Row } from '../lib/rows';
import { productFromRow, productToRow, type Product } from './types';

function toProducts(rows: unknown): Product[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Row[]).map((m) => productFromRow(m, rowString(m['id'])));
}

export async function fetchProducts(ownerId: string): Promise<Product[]> {
  try {
    const { data, error } = await getSupabase()
      .from('products')
      .select()
      .eq('owner_id', ownerId)
      .order('name');
    if (error) throw error;
    return toProducts(data);
  } catch (e) {
    throw mapSupabase(e);
  }
}

export async function createProduct(p: Omit<Product, 'id'>, draftId: string): Promise<string> {
  try {
    const { data, error } = await getSupabase()
      .from('products')
      .insert({ ...productToRow(p), id: draftId })
      .select('id')
      .single();
    if (error) throw error;
    return rowString((data as Row)['id']);
  } catch (e) {
    if (isUniqueViolation(e)) {
      try {
        const { data } = await getSupabase()
          .from('products')
          .select('id')
          .eq('id', draftId)
          .maybeSingle();
        if (data) return draftId;
      } catch {}
    }
    throw mapSupabase(e);
  }
}

export async function updateProduct(id: string, p: Omit<Product, 'id'>): Promise<void> {
  try {
    const { error } = await getSupabase()
      .from('products')
      .update(productToRow(p))
      .eq('id', id);
    if (error) throw error;
  } catch (e) {
    throw mapSupabase(e);
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    const { error } = await getSupabase().from('products').delete().eq('id', id);
    if (error) throw error;
  } catch (e) {
    throw mapSupabase(e);
  }
}
