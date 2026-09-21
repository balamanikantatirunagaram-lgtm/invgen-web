import { decodeLogo, type CompanySettings } from '../api/types';

/**
 * Document title for the PDF header. Companies without a GSTIN issue
 * Bills of Supply (no tax) — a compliance requirement, not a style.
 */
export function docTitleFor(company: Pick<CompanySettings, 'gstin'>): string {
  return company.gstin.trim() === '' ? 'BILL OF SUPPLY' : 'TAX INVOICE';
}

/** JPEG data URI for the embedded logo. Null when absent/corrupt (never throws). */
export function logoDataUrl(base64: string): string | null {
  const bytes = decodeLogo(base64);
  if (!bytes) return null;
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  try {
    return `data:image/jpeg;base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}
