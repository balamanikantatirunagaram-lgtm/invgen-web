/**
 * Quotation ledger: mirrors invoices API but for quotations.
 * Statuses: draft, sent, accepted, converted, expired.
 * Convert builds an invoice atomically and marks the quote converted.
 */
import { getSupabase } from '../supabase/client';
import { AppError, isUniqueViolation, mapSupabase } from '../lib/errors';
import { rowString, type Row } from '../lib/rows';
import {
  applyQuotationFilter,
  formatQuotationNumber,
  quotationFromRow,
  quotationToRow,
  type Quotation,
  type QuotationFilter,
  type QuotationStatus,
} from './types';
import { bumpCounterBestEffort } from './counters';
import { assertQuota } from './usage';
import { createInvoiceAtomic, type NewInvoice } from './invoices';

export type { QuotationFilter };

const LIST_CAP = 500;

function toQuotations(rows: unknown): Quotation[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Row[]).map(quotationFromRow);
}

async function baseList(ownerId: string): Promise<Quotation[]> {
  const { data, error } = await getSupabase()
    .from('quotations')
    .select()
    .eq('owner_id', ownerId)
    .order('quotation_date', { ascending: false })
    .limit(LIST_CAP);
  if (error) throw error;
  return toQuotations(data);
}

export async function fetchQuotations(
  ownerId: string,
  filter: QuotationFilter = {},
  limit = 20,
): Promise<Quotation[]> {
  try {
    const list = await baseList(ownerId);
    return applyQuotationFilter(list, filter, limit);
  } catch (e) {
    throw mapSupabase(e);
  }
}

export async function fetchQuotationById(id: string): Promise<Quotation | null> {
  try {
    const { data, error } = await getSupabase()
      .from('quotations')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return quotationFromRow(data as Row);
  } catch (e) {
    throw mapSupabase(e);
  }
}

export type NewQuotation = Omit<Quotation, 'quotationId' | 'createdAt' | 'updatedAt'>;

function nowIso(): string {
  return new Date().toISOString();
}

function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export async function createQuotationAtomic(
  ownerId: string,
  prefix: string,
  draftId: string,
  build: (number: string) => NewQuotation,
): Promise<string> {
  const maxAttempts = 8;
  const p = prefix === '' ? 'QUO-' : prefix;
  await assertQuota(ownerId, 'quotations');

  const existing = new Set<string>();
  try {
    const { data, error } = await getSupabase()
      .from('quotations')
      .select('quotation_number')
      .eq('owner_id', ownerId)
      .like('quotation_number', `${escapeLike(p)}%`)
      .limit(1000);
    if (error) throw error;
    for (const r of (Array.isArray(data) ? data : []) as Row[]) {
      existing.add(rowString(r['quotation_number']));
    }
  } catch (e) {
    throw mapSupabase(e);
  }

  // Per-prefix independent sequence (H5 fix: first QUO is 0001, not shared with invoices)
  let next: number;
  if (existing.size > 0) {
    let max = 0;
    for (const n of existing) {
      const num = parseInt(n.slice(p.length), 10);
      if (Number.isFinite(num) && num > max) max = num;
    }
    next = max + 1;
    while (existing.has(formatQuotationNumber(p, next))) next++;
  } else {
    next = 1;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const number = formatQuotationNumber(p, next);
    try {
      const q = build(number);
      if (q.items.length === 0) {
        throw AppError.validation('Add at least one item.');
      }
      const { data, error } = await getSupabase()
        .from('quotations')
        .insert({ ...quotationToRow(q), id: draftId })
        .select('id')
        .single();
      if (error) throw error;
      const id = rowString((data as Row)['id']);
      await bumpCounterBestEffort(ownerId, next);
      return id;
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (isUniqueViolation(e)) {
        try {
          const { data } = await getSupabase()
            .from('quotations')
            .select('id')
            .eq('id', draftId)
            .maybeSingle();
          if (data) return draftId;
        } catch {}
        
        existing.add(number);
        next++;
        continue;
      }
      throw mapSupabase(e);
    }
  }
  throw AppError.conflict('Could not reserve a free quotation number. Try again.');
}

export async function updateQuotation(id: string, q: NewQuotation): Promise<void> {
  try {
    const existing = await fetchQuotationById(id);
    if (!existing) throw AppError.notFound('Quotation not found.');
    if (existing.status === 'converted') {
      throw AppError.validation('Converted quotations cannot be edited.');
    }
    if (q.quotationNumber !== existing.quotationNumber) {
      throw AppError.validation('Quotation number cannot be changed after creation.');
    }
    const { error } = await getSupabase()
      .from('quotations')
      .update({ ...quotationToRow(q), updated_at: nowIso() })
      .eq('id', id)
      .neq('status', 'converted');
    if (error) throw error;
  } catch (e) {
    throw mapSupabase(e);
  }
}

export async function deleteQuotation(id: string): Promise<void> {
  try {
    const existing = await fetchQuotationById(id);
    if (!existing) throw AppError.notFound('Quotation not found.');
    if (existing.status !== 'draft') {
      throw AppError.validation('Only draft quotations can be deleted.');
    }
    const { error } = await getSupabase()
      .from('quotations')
      .delete()
      .eq('id', id)
      .eq('status', 'draft');
    if (error) throw error;
  } catch (e) {
    throw mapSupabase(e);
  }
}

const ALLOWED: QuotationStatus[] = ['draft', 'sent', 'accepted', 'converted', 'expired'];

export async function setQuotationStatus(id: string, status: QuotationStatus): Promise<void> {
  if (!ALLOWED.includes(status)) {
    throw AppError.validation(`Invalid status: ${status}`);
  }
  try {
    const existing = await fetchQuotationById(id);
    if (!existing) throw AppError.notFound('Quotation not found.');
    if (existing.status === 'converted') {
      throw AppError.validation('Converted quotations cannot change status.');
    }
    const { error } = await getSupabase()
      .from('quotations')
      .update({ status, updated_at: nowIso() })
      .eq('id', id)
      .neq('status', 'converted');
    if (error) throw error;
  } catch (e) {
    throw mapSupabase(e);
  }
}

/**
 * Convert a quotation to an invoice: creates a draft invoice atomically
 * then marks the quotation as converted with the new invoice id.
 * Returns the new invoice id.
 */
export async function convertQuotationToInvoice(
  ownerId: string,
  quotation: Quotation,
  invoicePrefix: string,
): Promise<string> {
  if (quotation.status === 'converted') {
    throw AppError.validation('Quotation already converted.');
  }
  // Build invoice from quotation snapshot
  const invoiceId = await createInvoiceAtomic(ownerId, invoicePrefix, crypto.randomUUID(), (number: string) => {
    const inv: NewInvoice = {
      ownerId,
      invoiceNumber: number,
      invoiceDate: new Date(),
      poNumber: '',
      poDate: null,
      vehicleNumber: '',
      copyType: 'Original for Recipient',
      billTo: { ...quotation.billTo },
      shipTo: { ...quotation.shipTo },
      items: quotation.items.map((i) => ({ ...i })),
      isInterstate: quotation.isInterstate,
      subTotal: quotation.subTotal,
      totalTaxableValue: quotation.totalTaxableValue,
      totalCGST: quotation.totalCGST,
      totalSGST: quotation.totalSGST,
      totalIGST: quotation.totalIGST,
      roundOff: quotation.roundOff,
      grandTotal: quotation.grandTotal,
      amountInWords: quotation.amountInWords,
      status: 'draft',
      template: quotation.template,
    };
    return inv;
  });

  // Mark quotation converted
  const { error } = await getSupabase()
    .from('quotations')
    .update({
      status: 'converted',
      converted_invoice_id: invoiceId,
      updated_at: nowIso(),
    })
    .eq('id', quotation.quotationId);
  if (error) throw mapSupabase(error);

  return invoiceId;
}
