/**
 * Dashboard aggregates — mirrors mobile dashboard_screen.dart grouping
 * (client-side over ≤300 invoices; cancelled excluded from revenue).
 * Pure functions — unit tested.
 */
import type { Invoice } from '../../api/types';

export interface MonthKey {
  year: number;
  month: number; // 1-12
}

export function monthKeyOf(d: Date): MonthKey {
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function shiftMonth(m: MonthKey, delta: number): MonthKey {
  const d = new Date(m.year, m.month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function isAfterMonth(a: MonthKey, b: MonthKey): boolean {
  return a.year > b.year || (a.year === b.year && a.month > b.month);
}

export interface DashboardStats {
  /** Non-cancelled invoices. */
  visible: Invoice[];
  inMonth: Invoice[];
  revenue: number;
  prevRevenue: number;
  /** % change vs prev month, null when no prior revenue. */
  deltaPct: number | null;
  outstanding: number;
  paid: number;
  /** issued awaiting payment. */
  overdueCount: number;
  unpaidCount: number;
  paidCount: number;
  cancelledCount: number;
  taxMonth: { cgst: number; sgst: number; igst: number };
  /** Newest first, top 5. */
  recent: Invoice[];
}

export function computeDashboard(all: Invoice[], month: MonthKey): DashboardStats {
  const visible = all.filter((i) => i.status !== 'cancelled');
  const prev = shiftMonth(month, -1);
  const inMonth = visible.filter((i) => {
    const k = monthKeyOf(i.invoiceDate);
    return k.year === month.year && k.month === month.month;
  });
  const inPrev = visible.filter((i) => {
    const k = monthKeyOf(i.invoiceDate);
    return k.year === prev.year && k.month === prev.month;
  });

  const sum = (list: Invoice[]) => list.reduce((s, i) => s + i.grandTotal, 0);
  const revenue = sum(inMonth);
  const prevRevenue = sum(inPrev);
  const deltaPct = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;

  const open = visible.filter((i) => i.status === 'issued' || i.status === 'draft');
  const paidList = visible.filter((i) => i.status === 'paid');

  const taxMonth = inMonth.reduce(
    (t, i) => ({
      cgst: t.cgst + i.totalCGST,
      sgst: t.sgst + i.totalSGST,
      igst: t.igst + i.totalIGST,
    }),
    { cgst: 0, sgst: 0, igst: 0 },
  );

  const recent = [...all]
    .sort((a, b) => b.invoiceDate.getTime() - a.invoiceDate.getTime())
    .slice(0, 5);

  return {
    visible,
    inMonth,
    revenue,
    prevRevenue,
    deltaPct,
    outstanding: sum(open),
    paid: sum(paidList),
    overdueCount: visible.filter((i) => i.status === 'issued').length,
    unpaidCount: visible.filter((i) => i.status !== 'paid').length,
    paidCount: paidList.length,
    cancelledCount: all.filter((i) => i.status === 'cancelled').length,
    taxMonth,
    recent,
  };
}

/** Time-of-day greeting (mirrors mobile). */
export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
