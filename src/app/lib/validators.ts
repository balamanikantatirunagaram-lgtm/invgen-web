/**
 * Field validators shared by all forms — TypeScript port of
 * INVGEN-APP `lib/core/utils/validators.dart`.
 * Each returns an error message string, or null when valid.
 */

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const HSN_RE = /^[0-9]{4,8}$/;
const MOBILE_RE = /^[6-9][0-9]{9}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function requiredField(v: string | null | undefined, label = 'This field'): string | null {
  if (v == null || v.trim() === '') return `${label} is required`;
  return null;
}

export function validateGstin(v: string | null | undefined, required = true): string | null {
  const s = (v ?? '').trim().toUpperCase();
  if (s === '') return required ? 'GSTIN is required' : null;
  if (s.length !== 15) return 'GSTIN must be 15 characters';
  if (!GSTIN_RE.test(s)) return 'Invalid GSTIN format';
  return null;
}

export function validateHsn(v: string | null | undefined, required = true): string | null {
  const s = (v ?? '').trim();
  if (s === '') return required ? 'HSN is required' : null;
  if (!HSN_RE.test(s)) return 'HSN must be 4–8 digits';
  return null;
}

export function validateMobile(v: string | null | undefined, required = true): string | null {
  const s = (v ?? '').trim();
  if (s === '') return required ? 'Mobile is required' : null;
  if (!MOBILE_RE.test(s)) return 'Enter valid 10-digit mobile';
  return null;
}

export function validateEmail(v: string | null | undefined, required = true): string | null {
  const s = (v ?? '').trim();
  if (s === '') return required ? 'Email is required' : null;
  if (!EMAIL_RE.test(s)) return 'Enter valid email';
  return null;
}

export function validateIfsc(v: string | null | undefined, required = false): string | null {
  const s = (v ?? '').trim().toUpperCase();
  if (s === '') return required ? 'IFSC is required' : null;
  if (!IFSC_RE.test(s)) return 'Invalid IFSC (e.g. HDFC0001234)';
  return null;
}

export function validateRate(v: string | null | undefined): string | null {
  if (v == null || v.trim() === '') return 'Rate required';
  const d = Number(v.trim());
  if (!Number.isFinite(d) || d < 0) return 'Rate must be >= 0';
  return null;
}

export function validateQty(v: string | null | undefined): string | null {
  if (v == null || v.trim() === '') return 'Qty required';
  const d = Number(v.trim());
  if (!Number.isFinite(d) || d <= 0) return 'Qty must be > 0';
  return null;
}

export function validateGstRate(v: number | null | undefined): string | null {
  if (v == null || Number.isNaN(v)) return 'GST % required';
  if (v < 0 || v > 28) return 'GST must be 0–28%';
  return null;
}

/** Extract state code (first 2 digits) from GSTIN for interstate detection. */
export function gstStateCode(gstin: string): string | null {
  const s = gstin.trim().toUpperCase();
  if (s.length < 2) return null;
  return s.slice(0, 2);
}
