/**
 * Invoice ledger: list with client-side filters, CRUD, atomic create.
 * Mirrors mobile InvoiceRepository semantics:
 * - One base query (newest first, cap 500); date/status/text filters
 *   applied client-side to keep a single simple subscription per user.
 * - Number immutable after creation; cancelled blocks edit/status change.
 * - Hard delete drafts only; issued/paid use cancelInvoice (append-only
 *   `invoice_events` audit row).
 * - createAtomic reserves a free number with 23505 retries (max 8).
 */
import { getSupabase } from '../supabase/client';
import { AppError, isUniqueViolation, mapSupabase } from '../lib/errors';
import { rowString, type Row } from '../lib/rows';
import {
  applyInvoiceFilter,
  formatInvoiceNumber,
  invoiceFromRow,
  invoiceToRow,
  type Invoice,
  type InvoiceFilter,
} from './types';
import { bumpCounterBestEffort, peekCounter } from './counters';

export type { InvoiceFilter };

const LIST_CAP = 500;

function toInvoices(rows: unknown): Invoice[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Row[]).map(invoiceFromRow);
}

async function baseList(ownerId: string): Promise<Invoice[]> {
  const { data, error } = await getSupabase()
    .from('invoices')
    .select()
    .eq('owner_id', ownerId)
    .order('invoice_date', { ascending: false })
    .limit(LIST_CAP);
  if (error) throw error;
  return toInvoices(data);
}

export async function fetchInvoices(
  ownerId: string,
  filter: InvoiceFilter = {},
  limit = 20,
): Promise<Invoice[]> {
  try {
    const list = await baseList(ownerId);
    return applyInvoiceFilter(list, filter, limit);
  } catch (e) {
    throw mapSupabase(e);
  }
}

export async function fetchInvoiceById(id: string): Promise<Invoice | null> {
  try {
    const { data, error } = await getSupabase()
      .from('invoices')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return invoiceFromRow(data as Row);
  } catch (e) {
    throw mapSupabase(e);
  }
}

export async function invoiceNumberExists(
  ownerId: string,
  number: string,
  excludeId?: string,
): Promise<boolean> {
  try {
    const { data, error } = await getSupabase()
      .from('invoices')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('invoice_number', number)
      .limit(2);
    if (error) throw error;
    const rows = Array.isArray(data) ? (data as Row[]) : [];
    if (rows.length === 0) return false;
    if (!excludeId) return true;
    return rows.some((r) => rowString(r['id']) !== excludeId);
  } catch (e) {
    throw mapSupabase(e);
  }
}

export type NewInvoice = Omit<Invoice, 'invoiceId' | 'createdAt' | 'updatedAt' | 'cancelledAt'>;

function nowIso(): string {
  return new Date().toISOString();
}

/** Escape LIKE wildcards in the user-editable prefix. */
function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * AUTHORITATIVE create (use for all new invoices).
 * Uniqueness enforced by UNIQUE(owner_id, invoice_number): concurrent
 * creators racing the same number get 23505 and retry with the next free
 * sequence. Returns the new row id.
 */
export async function createInvoiceAtomic(
  ownerId: string,
  prefix: string,
  build: (number: string) => NewInvoice,
): Promise<string> {
  const maxAttempts = 8;
  const p = prefix === '' ? 'INV-' : prefix;

  // Existing numbers with this prefix (single list query).
  const existing = new Set<string>();
  try {
    const { data, error } = await getSupabase()
      .from('invoices')
      .select('invoice_number')
      .eq('owner_id', ownerId)
      .like('invoice_number', `${escapeLike(p)}%`)
      .limit(1000);
    if (error) throw error;
    for (const r of (Array.isArray(data) ? data : []) as Row[]) {
      existing.add(rowString(r['invoice_number']));
    }
  } catch (e) {
    throw mapSupabase(e);
  }

  // Advisory starting point from the counter (0 when absent).
  let start = 0;
  try {
    start = await peekCounter(ownerId);
  } catch {
    start = 0; // counter read failure must not block creation
  }

  let next = start + 1;
  while (existing.has(formatInvoiceNumber(p, next))) next++;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const number = formatInvoiceNumber(p, next);
    try {
      const inv = build(number);
      if (inv.items.length === 0) {
        throw AppError.validation('Add at least one item.');
      }
      const { data, error } = await getSupabase()
        .from('invoices')
        .insert(invoiceToRow(inv))
        .select('id')
        .single();
      if (error) throw error;
      const id = rowString((data as Row)['id']);
      // Advisory counter bump (never fails the save).
      await bumpCounterBestEffort(ownerId, next);
      return id;
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (isUniqueViolation(e)) {
        existing.add(number); // someone took it → next free
        next++;
        continue;
      }
      // Transient network? surface mapped error (no blind retry on
      // unknown failures — the insert may have succeeded).
      throw mapSupabase(e);
    }
  }
  throw AppError.conflict('Could not reserve a free invoice number. Try again.');
}

export async function updateInvoice(id: string, inv: NewInvoice): Promise<void> {
  try {
    // Number is immutable after creation (auto-assigned by createAtomic).
    const existing = await fetchInvoiceById(id);
    if (!existing) throw AppError.notFound('Invoice not found.');
    if (existing.status === 'cancelled') {
      throw AppError.validation('Cancelled invoices cannot be edited.');
    }
    if (inv.invoiceNumber !== existing.invoiceNumber) {
      throw AppError.validation('Invoice number cannot be changed after creation.');
    }
    // Guard TOCTOU: do not overwrite a concurrently cancelled doc.
    const { error } = await getSupabase()
      .from('invoices')
      .update({ ...invoiceToRow(inv), updated_at: nowIso() })
      .eq('id', id)
      .neq('status', 'cancelled');
    if (error) throw error;
  } catch (e) {
    throw mapSupabase(e);
  }
}

/**
 * Hard delete is allowed ONLY for drafts; issued/paid must use
 * cancelInvoice to preserve the GST-compliant sequential record.
 */
export async function deleteInvoice(id: string): Promise<void> {
  try {
    const existing = await fetchInvoiceById(id);
    if (!existing) throw AppError.notFound('Invoice not found.');
    if (existing.status !== 'draft') {
      throw AppError.validation(
        'Only draft invoices can be deleted. Cancel issued invoices instead.',
      );
    }
    // Guard TOCTOU: DB enforces draft-only even if issued on another
    // device between fetch and delete.
    const { error } = await getSupabase()
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('status', 'draft');
    if (error) throw error;
  } catch (e) {
    throw mapSupabase(e);
  }
}

/** Soft-cancel: keeps the sequential record, blocks edits/deletes. */
export async function cancelInvoice(id: string): Promise<void> {
  try {
    const existing = await fetchInvoiceById(id);
    if (!existing) throw AppError.notFound('Invoice not found.');
    if (existing.status === 'cancelled') return;
    if (existing.status === 'draft') {
      throw AppError.validation('Drafts should be deleted, not cancelled.');
    }
    const { error } = await getSupabase()
      .from('invoices')
      .update({ status: 'cancelled', cancelled_at: nowIso(), updated_at: nowIso() })
      .eq('id', id)
      .neq('status', 'cancelled')
      .neq('status', 'draft');
    if (error) throw error;
    // Append-only audit event (no update/delete RLS policies exist).
    const { error: evtError } = await getSupabase().from('invoice_events').insert({
      invoice_id: id,
      type: 'cancelled',
      at: nowIso(),
      grand_total: existing.grandTotal,
    });
    if (evtError) throw evtError;
  } catch (e) {
    throw mapSupabase(e);
  }
}

const ALLOWED_STATUSES = ['draft', 'issued', 'paid', 'cancelled'];

export async function setInvoiceStatus(id: string, status: string): Promise<void> {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw AppError.validation(`Invalid status: ${status}`);
  }
  try {
    const existing = await fetchInvoiceById(id);
    if (!existing) throw AppError.notFound('Invoice not found.');
    if (existing.status === 'cancelled') {
      throw AppError.validation('Cancelled invoices cannot change status.');
    }
    const { error } = await getSupabase()
      .from('invoices')
      .update({ status, updated_at: nowIso() })
      .eq('id', id)
      .neq('status', 'cancelled');
    if (error) throw error;
  } catch (e) {
    throw mapSupabase(e);
  }
}

/** Duplicate: clone an invoice's parties+items under a fresh atomic number. */
export async function duplicateInvoice(
  ownerId: string,
  prefix: string,
  source: Invoice,
): Promise<string> {
  return createInvoiceAtomic(ownerId, prefix, (number) => ({
    ownerId,
    invoiceNumber: number,
    invoiceDate: new Date(),
    poNumber: '',
    poDate: null,
    vehicleNumber: source.vehicleNumber,
    copyType: source.copyType,
    billTo: { ...source.billTo },
    shipTo: { ...source.shipTo },
    items: source.items.map((i) => ({ ...i })),
    isInterstate: source.isInterstate,
    subTotal: source.subTotal,
    totalTaxableValue: source.totalTaxableValue,
    totalCGST: source.totalCGST,
    totalSGST: source.totalSGST,
    totalIGST: source.totalIGST,
    roundOff: source.roundOff,
    grandTotal: source.grandTotal,
    amountInWords: source.amountInWords,
    status: 'draft',
  }));
}
