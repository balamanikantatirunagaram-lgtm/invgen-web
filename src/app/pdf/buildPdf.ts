import { createElement, type ReactElement } from 'react';
import { pdf, type DocumentProps } from '@react-pdf/renderer';
import { InvoiceDocument } from './invoiceDocument';
import type { CompanySettings, Invoice, InvoiceTemplate } from '../api/types';

/**
 * Render the invoice to PDF bytes (Uint8Array).
 * Uses toBlob (browser + node 18+); falls back to toBuffer.
 * Never recomputes tax — renders stored invoice totals.
 */
export async function buildInvoicePdf(
  inv: Invoice,
  company: CompanySettings,
  template: InvoiceTemplate,
  opts: { docTitle?: string } = {},
): Promise<Uint8Array> {
  const doc = createElement(InvoiceDocument, {
    inv,
    company,
    template,
    docTitle: opts.docTitle ?? 'TAX INVOICE',
  }) as unknown as ReactElement<DocumentProps>;
  const instance = pdf(doc);
  try {
    const blob = (await instance.toBlob()) as Blob;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    const buf = (await instance.toBuffer()) as unknown as Uint8Array | Buffer;
    return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  }
}
