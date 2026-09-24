import { createElement, type ReactElement } from 'react';
import { pdf, type DocumentProps } from '@react-pdf/renderer';
import { InvoiceDocument } from './invoiceDocument';
import type { CompanySettings, Invoice, InvoiceTemplate } from '../api/types';
import { getSupabase } from '../supabase/client';
import { OFFLINE_TEMPLATES } from '../hooks/useTemplates';

export async function buildInvoicePdf(
  inv: Invoice,
  company: CompanySettings,
  template: InvoiceTemplate,
  opts: { docTitle?: string; watermark?: boolean; draft?: boolean } = {},
): Promise<Uint8Array> {
  // Try to resolve the template definition
  let templateDef = OFFLINE_TEMPLATES.find(t => t.id === template);
  
  if (!templateDef) {
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase.from('invoice_templates').select('*').eq('id', template).single();
      if (data) {
        templateDef = {
          id: data.id,
          name: data.name,
          base_layout: data.base_layout as any,
          is_pro: data.is_pro,
          style_config: data.style_config || {}
        };
      }
    }
  }
  
  // Fallback to classic if somehow missing
  if (!templateDef) {
    templateDef = OFFLINE_TEMPLATES[0];
  }

  const doc = createElement(InvoiceDocument, {
    inv,
    company,
    templateDef,
    docTitle: opts.docTitle ?? 'TAX INVOICE',
    watermark: opts.watermark ?? true,
    draft: opts.draft ?? inv.status === 'draft',
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
