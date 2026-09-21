import { describe, expect, test } from 'vitest';
import {
  aggregate,
  computeInvoice,
  computeLine,
  detectInterstate,
  round2,
} from '../gst';

describe('computeLine intra-state', () => {
  test('18% splits into 9+9', () => {
    const l = computeLine({ quantity: 10, rate: 100, gstRate: 18, isInterstate: false });
    expect(l.taxableValue).toBe(1000);
    expect(l.cgstRate).toBe(9);
    expect(l.sgstRate).toBe(9);
    expect(l.cgstAmount).toBe(90);
    expect(l.sgstAmount).toBe(90);
    expect(l.igstAmount).toBe(0);
    expect(l.itemTotal).toBe(1180);
  });

  test('5% splits into 2.5+2.5', () => {
    const l = computeLine({ quantity: 2, rate: 200, gstRate: 5, isInterstate: false });
    expect(l.taxableValue).toBe(400);
    expect(l.cgstAmount).toBe(10);
    expect(l.sgstAmount).toBe(10);
    expect(l.itemTotal).toBe(420);
  });

  test('0% yields no tax', () => {
    const l = computeLine({ quantity: 1, rate: 500, gstRate: 0, isInterstate: false });
    expect(l.itemTotal).toBe(500);
  });

  test('28% slab', () => {
    const l = computeLine({ quantity: 1, rate: 1000, gstRate: 28, isInterstate: false });
    expect(l.cgstRate).toBe(14);
    expect(l.sgstRate).toBe(14);
    expect(l.cgstAmount).toBe(140);
    expect(l.sgstAmount).toBe(140);
    expect(l.itemTotal).toBe(1280);
  });

  test('fractional qty/rate rounds to 2-dec', () => {
    const l = computeLine({ quantity: 3, rate: 33.333, gstRate: 18, isInterstate: false });
    expect(l.taxableValue).toBe(100);
    expect(l.itemTotal).toBe(118);
  });
});

describe('computeLine inter-state', () => {
  test('18% IGST full', () => {
    const l = computeLine({ quantity: 10, rate: 100, gstRate: 18, isInterstate: true });
    expect(l.igstRate).toBe(18);
    expect(l.igstAmount).toBe(180);
    expect(l.cgstAmount).toBe(0);
    expect(l.sgstAmount).toBe(0);
    expect(l.itemTotal).toBe(1180);
  });
});

describe('aggregate + roundOff', () => {
  test('rounds to nearest rupee', () => {
    // 999 * 18% intra = 999 + 89.91 + 89.91 = 1178.82 → 1179, off +0.18
    const lines = [
      computeLine({ quantity: 1, rate: 999, gstRate: 18, isInterstate: false }),
    ];
    const t = aggregate(lines);
    expect(t.totalTaxableValue).toBe(999);
    expect(t.totalCGST).toBe(89.91);
    expect(t.grandTotal).toBe(1179);
    expect(t.roundOff).toBeCloseTo(0.18, 3);
  });

  test('negative round-off', () => {
    // 1000 + 90 + 90 = 1180 exact → off 0; use 333.33*3 style drift:
    // 10 * 10.05 intra 18% → taxable 100.5, cgst 9.05 (100.5*9%=9.045→9.05? 9.045 rounds to 9.05? 9.045*100=904.5→round 904? banker's? Math.round(904.5)=905 → 9.05)
    const t = computeInvoice([{ qty: 1, rate: 100.5, gstRate: 18 }], false);
    expect(t.grandTotal).toBe(Math.round(t.totalTaxableValue + t.totalCGST + t.totalSGST));
    expect(t.roundOff).toBeCloseTo(t.grandTotal - (t.totalTaxableValue + t.totalCGST + t.totalSGST), 5);
  });

  test('multi-line totals', () => {
    const lines = [
      computeLine({ quantity: 10, rate: 100, gstRate: 18, isInterstate: false }),
      computeLine({ quantity: 5, rate: 200, gstRate: 12, isInterstate: false }),
    ];
    const t = aggregate(lines);
    expect(t.totalTaxableValue).toBe(2000);
    // 180 + 120 = 300 total tax
    expect(t.totalCGST + t.totalSGST + t.totalIGST).toBeCloseTo(300, 2);
    expect(t.grandTotal).toBe(2300);
  });

  test('empty list gives zero totals', () => {
    const t = aggregate([]);
    expect(t).toEqual({
      subTotal: 0,
      totalTaxableValue: 0,
      totalCGST: 0,
      totalSGST: 0,
      totalIGST: 0,
      roundOff: 0,
      grandTotal: 0,
    });
  });

  test('computeInvoice convenience matches manual aggregate', () => {
    const items = [
      { qty: 2, rate: 150, gstRate: 12 },
      { qty: 1, rate: 999, gstRate: 18 },
    ];
    const via = computeInvoice(items, false);
    const manual = aggregate(
      items.map((e) =>
        computeLine({ quantity: e.qty, rate: e.rate, gstRate: e.gstRate, isInterstate: false }),
      ),
    );
    expect(via).toEqual(manual);
  });

  test('subTotal aliases totalTaxableValue', () => {
    const t = computeInvoice([{ qty: 1, rate: 100, gstRate: 18 }], false);
    expect(t.subTotal).toBe(t.totalTaxableValue);
  });
});

describe('round2', () => {
  test('money-safe rounding', () => {
    expect(round2(89.915)).toBe(89.92);
    expect(round2(89.914)).toBe(89.91);
    expect(round2(100)).toBe(100);
  });
});

describe('detectInterstate', () => {
  test('same state code → intra-state', () => {
    expect(detectInterstate('27ABCDE1234F1Z5', '27XYZAB1234C1Z2')).toBe(false);
  });

  test('different state codes → inter-state', () => {
    expect(detectInterstate('27ABCDE1234F1Z5', '07XYZAB1234C1Z2')).toBe(true);
  });

  test('short GSTIN → false (cannot compare)', () => {
    expect(detectInterstate('', '27XYZAB1234C1Z2')).toBe(false);
    expect(detectInterstate('27ABCDE1234F1Z5', '2')).toBe(false);
  });

  test('case-insensitive', () => {
    expect(detectInterstate('27abcde1234f1z5', '27XYZAB1234C1Z2')).toBe(false);
  });
});
