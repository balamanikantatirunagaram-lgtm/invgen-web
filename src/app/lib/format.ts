/**
 * Date + currency formatting (Indian locale) — TypeScript port of
 * INVGEN-APP `lib/core/utils/formatters.dart` (intl en_IN).
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const qtyFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
});

export function fmtInr(v: number): string {
  return inrFormatter.format(v);
}

export function fmtQty(v: number): string {
  return qtyFormatter.format(v);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Format as dd-MM-yyyy (matches mobile `dmyFormat`). */
export function fmtDate(d: Date): string {
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Parse a decimal string typed by user: keeps dot, strips commas/₹/spaces.
 *  Never strips trailing zeros or the decimal point. Returns NaN on empty.
 *  Examples: "10.50"→10.5, "2.0"→2, "1,250.00"→1250, "₹ 99.60"→99.6
 */
export function parseDecimal(raw: string): number {
  if (raw.trim() === '') return NaN;
  // Keep digits, single dot, minus. Strip commas, currency, spaces, etc.
  let s = raw.trim().replace(/[₹,\s]/g, '');
  // Keep only first dot, remove extras
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  // Strip leading + but keep -
  s = s.replace(/^\+/, '');
  if (s === '' || s === '.' || s === '-' || s === '-.') return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Strict parse of dd-MM-yyyy. Throws on invalid input. */
export function parseDmy(s: string): Date {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s.trim());
  if (!m) throw new Error(`Invalid date (expected dd-MM-yyyy): ${s}`);
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    throw new Error(`Invalid date: ${s}`);
  }
  return d;
}
