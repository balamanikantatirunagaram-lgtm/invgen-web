import { describe, expect, test } from 'vitest';
import { fmtDate, fmtInr, fmtQty, parseDmy } from '../format';

describe('fmtInr', () => {
  test('Indian grouping with ₹ and 2 decimals', () => {
    expect(fmtInr(1180)).toBe('₹1,180.00');
    expect(fmtInr(12345678)).toBe('₹1,23,45,678.00');
  });
});

describe('fmtQty', () => {
  test('trims trailing zeros', () => {
    expect(fmtQty(10)).toBe('10');
    expect(fmtQty(1.5)).toBe('1.5');
  });
});

describe('fmtDate / parseDmy', () => {
  test('round-trips dd-MM-yyyy', () => {
    const d = new Date(2026, 8, 21);
    expect(fmtDate(d)).toBe('21-09-2026');
    expect(parseDmy('21-09-2026').getTime()).toBe(d.getTime());
  });

  test('rejects invalid dates', () => {
    expect(() => parseDmy('31-02-2026')).toThrow();
    expect(() => parseDmy('2026-09-21')).toThrow();
    expect(() => parseDmy('nope')).toThrow();
  });
});
