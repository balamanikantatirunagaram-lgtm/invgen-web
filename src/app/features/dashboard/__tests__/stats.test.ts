import { describe, expect, test } from 'vitest';
import {
  computeDashboard,
  greeting,
  isAfterMonth,
  shiftMonth,
  type MonthKey,
} from '../stats';
import type { Invoice } from '../../../api/types';

function inv(overrides: Partial<Invoice> & { invoiceId: string }): Invoice {
  return {
    ownerId: 'u1',
    invoiceNumber: 'INV-0001',
    invoiceDate: new Date('2026-09-05T00:00:00Z'),
    poNumber: '',
    poDate: null,
    vehicleNumber: '',
    copyType: 'Original for Recipient',
    billTo: {
      clientId: '',
      businessName: 'Acme',
      gstin: '',
      address: '',
      mobile: '',
      email: '',
    },
    shipTo: {
      clientId: '',
      businessName: '',
      gstin: '',
      address: '',
      mobile: '',
      email: '',
    },
    items: [],
    isInterstate: false,
    subTotal: 1000,
    totalTaxableValue: 1000,
    totalCGST: 90,
    totalSGST: 90,
    totalIGST: 0,
    roundOff: 0,
    grandTotal: 1180,
    amountInWords: '',
    status: 'issued',
    createdAt: null,
    updatedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

const SEP: MonthKey = { year: 2026, month: 9 };

describe('computeDashboard', () => {
  const list = [
    inv({ invoiceId: 'a', grandTotal: 1180, status: 'issued' }),
    inv({
      invoiceId: 'b',
      grandTotal: 2360,
      status: 'paid',
      totalCGST: 180,
      totalSGST: 180,
    }),
    inv({
      invoiceId: 'c',
      grandTotal: 500,
      status: 'issued',
      invoiceDate: new Date('2026-08-10T00:00:00Z'),
    }),
    inv({ invoiceId: 'd', grandTotal: 9999, status: 'cancelled' }),
    inv({
      invoiceId: 'e',
      grandTotal: 100,
      status: 'draft',
      invoiceDate: new Date('2026-09-20T00:00:00Z'),
    }),
  ];

  test('month revenue excludes cancelled + other months', () => {
    const s = computeDashboard(list, SEP);
    expect(s.revenue).toBe(1180 + 2360 + 100);
    expect(s.inMonth.map((i) => i.invoiceId).sort()).toEqual(['a', 'b', 'e']);
    expect(s.prevRevenue).toBe(500);
    expect(s.deltaPct).toBeCloseTo(((3640 - 500) / 500) * 100, 5);
  });

  test('outstanding / paid / overdue / counts', () => {
    const s = computeDashboard(list, SEP);
    expect(s.outstanding).toBe(1180 + 500 + 100); // issued + draft
    expect(s.paid).toBe(2360);
    expect(s.overdueCount).toBe(2); // issued a + c
    expect(s.unpaidCount).toBe(3);
    expect(s.paidCount).toBe(1);
    expect(s.cancelledCount).toBe(1);
    expect(s.visible).toHaveLength(4);
  });

  test('month tax split sums CGST/SGST/IGST', () => {
    const s = computeDashboard(list, SEP);
    expect(s.taxMonth).toEqual({ cgst: 90 + 180 + 90, sgst: 90 + 180 + 90, igst: 0 });
  });

  test('recent is newest-first, top 5 (includes cancelled, like mobile)', () => {
    const s = computeDashboard(list, SEP);
    // e Sep-20, then a/b/d share Sep-05 (stable order), then c Aug-10.
    expect(s.recent.map((i) => i.invoiceId)).toEqual(['e', 'a', 'b', 'd', 'c']);
  });

  test('delta null with no prior revenue', () => {
    const s = computeDashboard([inv({ invoiceId: 'a' })], SEP);
    expect(s.deltaPct).toBeNull();
  });

  test('empty ledger', () => {
    const s = computeDashboard([], SEP);
    expect(s.revenue).toBe(0);
    expect(s.recent).toEqual([]);
    expect(s.deltaPct).toBeNull();
  });
});

describe('month helpers', () => {
  test('shiftMonth wraps years', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  test('isAfterMonth', () => {
    expect(isAfterMonth({ year: 2026, month: 10 }, SEP)).toBe(true);
    expect(isAfterMonth(SEP, SEP)).toBe(false);
    expect(isAfterMonth({ year: 2025, month: 12 }, SEP)).toBe(false);
  });
});

describe('greeting', () => {
  test('by hour', () => {
    expect(greeting(8)).toBe('Good morning');
    expect(greeting(13)).toBe('Good afternoon');
    expect(greeting(20)).toBe('Good evening');
  });
});
