import { describe, expect, test } from 'vitest';
import { INDIAN_STATES, normalizeStateCode, stateName } from '../states';

describe('indian states', () => {
  test('37 codes, unique', () => {
    const codes = INDIAN_STATES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain('27');
    expect(codes).toContain('07');
  });

  test('stateName lookup', () => {
    expect(stateName('27')).toBe('Maharashtra');
    expect(stateName('99')).toBe('');
  });

  test('normalizeStateCode', () => {
    expect(normalizeStateCode('27')).toBe('27');
    expect(normalizeStateCode(' 07 ')).toBe('07');
    expect(normalizeStateCode('XX')).toBe('');
    expect(normalizeStateCode('')).toBe('');
    expect(normalizeStateCode(null)).toBe('');
  });
});
