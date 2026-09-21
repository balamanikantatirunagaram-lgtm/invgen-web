import { describe, expect, test } from 'vitest';
import { convertAmount, convertNumber } from '../amountWords';

describe('convertAmount', () => {
  test('zero', () => {
    expect(convertAmount(0)).toBe('ZERO RUPEES ONLY');
  });

  test('spec example 23955', () => {
    expect(convertAmount(23955)).toBe(
      'TWENTY THREE THOUSAND NINE HUNDRED FIFTY FIVE RUPEES ONLY',
    );
  });

  test('1180', () => {
    expect(convertAmount(1180)).toBe(
      'ONE THOUSAND ONE HUNDRED EIGHTY RUPEES ONLY',
    );
  });

  test('rounds paise to nearest rupee', () => {
    expect(convertAmount(1180.4)).toBe(
      'ONE THOUSAND ONE HUNDRED EIGHTY RUPEES ONLY',
    );
    expect(convertAmount(1180.5)).toBe(
      'ONE THOUSAND ONE HUNDRED EIGHTY ONE RUPEES ONLY',
    );
  });
});

describe('convertNumber', () => {
  test('hundred / thousand / lakh / crore', () => {
    expect(convertNumber(100)).toBe('ONE HUNDRED');
    expect(convertNumber(1000)).toBe('ONE THOUSAND');
    expect(convertNumber(100000)).toBe('ONE LAKH');
    expect(convertNumber(10000000)).toBe('ONE CRORE');
  });

  test('100000 mixed', () => {
    expect(convertNumber(12345678)).toBe(
      'ONE CRORE TWENTY THREE LAKH FORTY FIVE THOUSAND SIX HUNDRED SEVENTY EIGHT',
    );
  });

  test('teens and tens', () => {
    expect(convertNumber(19)).toBe('NINETEEN');
    expect(convertNumber(20)).toBe('TWENTY');
    expect(convertNumber(99)).toBe('NINETY NINE');
  });

  test('lakh boundary', () => {
    expect(convertNumber(100001)).toBe('ONE LAKH ONE');
    expect(convertNumber(999999999)).toContain('CRORE');
  });

  test('zero and negatives', () => {
    expect(convertNumber(0)).toBe('ZERO');
    expect(convertNumber(-5)).toBe('MINUS FIVE');
  });
});
