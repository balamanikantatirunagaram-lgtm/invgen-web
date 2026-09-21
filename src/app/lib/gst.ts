/**
 * SINGLE SOURCE OF TRUTH for all GST math — TypeScript port of
 * INVGEN-APP `lib/core/tax/gst_calculator.dart`.
 *
 * UI controllers AND the PDF service must call these functions — never
 * duplicate the formulas inline.
 *
 * GST rules implemented:
 * - Taxable Value = qty * rate (per line, rounded to 2 decimals)
 * - If intra-state (isInterstate == false):
 *     cgstRate = sgstRate = gstRate / 2
 *     cgstAmt  = taxable * cgstRate / 100
 *     sgstAmt  = taxable * sgstRate / 100
 *     igstRate = igstAmt = 0
 * - If inter-state (isInterstate == true):
 *     igstRate = gstRate
 *     igstAmt  = taxable * gstRate / 100
 *     cgst/sgst = 0
 * - itemTotal = taxable + cgst + sgst + igst
 * - Totals = sum of lines
 * - grandBeforeRound = totalTaxable + totalCGST + totalSGST + totalIGST
 * - grandTotal = round(grandBeforeRound) (nearest rupee)
 * - roundOff = grandTotal - grandBeforeRound (can be +/-, 2-dec)
 */

/** Rounds to 2 decimals (money-safe). Matches Dart `(v*100).round()/100`. */
export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Result of tax computation for ONE line item. */
export interface LineTax {
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  itemTotal: number;
}

/** Aggregated totals for the whole invoice. */
export interface InvoiceTotals {
  /** == totalTaxableValue (kept for UI compat). */
  subTotal: number;
  totalTaxableValue: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  roundOff: number;
  grandTotal: number;
}

export const ZERO_TOTALS: InvoiceTotals = {
  subTotal: 0,
  totalTaxableValue: 0,
  totalCGST: 0,
  totalSGST: 0,
  totalIGST: 0,
  roundOff: 0,
  grandTotal: 0,
};

export interface LineInput {
  quantity: number;
  rate: number;
  gstRate: number;
  isInterstate: boolean;
}

/** Compute tax for a single line. */
export function computeLine(input: LineInput): LineTax {
  const { quantity, rate, gstRate, isInterstate } = input;
  const taxable = round2(quantity * rate);

  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;
  let cgstAmt = 0;
  let sgstAmt = 0;
  let igstAmt = 0;

  if (isInterstate) {
    // Inter-state supply → IGST only (full rate).
    igstRate = gstRate;
    igstAmt = round2((taxable * gstRate) / 100);
  } else {
    // Intra-state supply → split equally into CGST + SGST.
    // e.g. 18% => 9% CGST + 9% SGST.
    // Note: for odd custom rates (e.g. 5.5) both halves still sum back to
    // gstRate; 2-dec rounding of halves is sufficient for display.
    cgstRate = round2(gstRate / 2);
    sgstRate = round2(gstRate / 2);
    cgstAmt = round2((taxable * cgstRate) / 100);
    sgstAmt = round2((taxable * sgstRate) / 100);
  }

  const total = round2(taxable + cgstAmt + sgstAmt + igstAmt);
  return {
    taxableValue: taxable,
    cgstRate,
    cgstAmount: cgstAmt,
    sgstRate,
    sgstAmount: sgstAmt,
    igstRate,
    igstAmount: igstAmt,
    itemTotal: total,
  };
}

/** Aggregate a list of already-computed lines. */
export function aggregate(lines: LineTax[]): InvoiceTotals {
  let tax = 0;
  let c = 0;
  let s = 0;
  let i = 0;
  for (const l of lines) {
    tax += l.taxableValue;
    c += l.cgstAmount;
    s += l.sgstAmount;
    i += l.igstAmount;
  }
  tax = round2(tax);
  c = round2(c);
  s = round2(s);
  i = round2(i);

  const exact = tax + c + s + i;
  const grand = Math.round(exact);
  const roundOff = round2(grand - exact);

  return {
    subTotal: tax,
    totalTaxableValue: tax,
    totalCGST: c,
    totalSGST: s,
    totalIGST: i,
    roundOff,
    grandTotal: grand,
  };
}

export interface InvoiceInput {
  qty: number;
  rate: number;
  gstRate: number;
}

/** Convenience: compute totals directly from raw inputs. */
export function computeInvoice(
  items: InvoiceInput[],
  isInterstate: boolean,
): InvoiceTotals {
  const lines = items.map((e) =>
    computeLine({
      quantity: e.qty,
      rate: e.rate,
      gstRate: e.gstRate,
      isInterstate,
    }),
  );
  return aggregate(lines);
}

/**
 * Auto-detect inter-state supply by comparing the first 2 digits
 * (state codes) of seller vs buyer GSTIN. Matches mobile behaviour;
 * the builder allows manual override via toggle.
 * Returns false when either GSTIN is too short to compare.
 */
export function detectInterstate(
  sellerGstin: string,
  buyerGstin: string,
): boolean {
  const s = sellerGstin.trim().toUpperCase();
  const b = buyerGstin.trim().toUpperCase();
  if (s.length < 2 || b.length < 2) return false;
  return s.slice(0, 2) !== b.slice(0, 2);
}
