import { describe, expect, test } from 'vitest';
import {
  gstStateCode,
  requiredField,
  validateEmail,
  validateGstin,
  validateGstRate,
  validateHsn,
  validateIfsc,
  validateMobile,
  validateQty,
  validateRate,
} from '../validators';

describe('requiredField', () => {
  test('blank fails, value passes', () => {
    expect(requiredField('', 'Name')).toBe('Name is required');
    expect(requiredField('  ')).toBe('This field is required');
    expect(requiredField(null)).toBe('This field is required');
    expect(requiredField('Acme')).toBeNull();
  });
});

describe('validateGstin', () => {
  test('valid GSTIN passes (uppercased)', () => {
    expect(validateGstin('27ABCDE1234F1Z5')).toBeNull();
    expect(validateGstin('27abcde1234f1z5')).toBeNull();
  });

  test('empty / wrong length / bad format', () => {
    expect(validateGstin('')).toBe('GSTIN is required');
    expect(validateGstin('', false)).toBeNull();
    expect(validateGstin('27ABCD')).toBe('GSTIN must be 15 characters');
    expect(validateGstin('27ABCDE1234F1Z@')).toBe('Invalid GSTIN format');
    expect(validateGstin('27ABCDE1234F1A5')).toBe('Invalid GSTIN format');
  });
});

describe('validateHsn', () => {
  test('4–8 digits pass', () => {
    expect(validateHsn('1001')).toBeNull();
    expect(validateHsn('12345678')).toBeNull();
    expect(validateHsn('123')).toBe('HSN must be 4–8 digits');
    expect(validateHsn('123456789')).toBe('HSN must be 4–8 digits');
    expect(validateHsn('12AB')).toBe('HSN must be 4–8 digits');
    expect(validateHsn('')).toBe('HSN is required');
    expect(validateHsn('', false)).toBeNull();
  });
});

describe('validateMobile', () => {
  test('10-digit starting 6–9 passes', () => {
    expect(validateMobile('9876543210')).toBeNull();
    expect(validateMobile('6123456789')).toBeNull();
    expect(validateMobile('5123456789')).toBe('Enter valid 10-digit mobile');
    expect(validateMobile('98765')).toBe('Enter valid 10-digit mobile');
    expect(validateMobile('')).toBe('Mobile is required');
  });
});

describe('validateEmail', () => {
  test('basic emails', () => {
    expect(validateEmail('a@b.com')).toBeNull();
    expect(validateEmail('nope')).toBe('Enter valid email');
    expect(validateEmail('')).toBe('Email is required');
    expect(validateEmail('', false)).toBeNull();
  });
});

describe('validateIfsc', () => {
  test('optional by default, strict format', () => {
    expect(validateIfsc('')).toBeNull();
    expect(validateIfsc('', true)).toBe('IFSC is required');
    expect(validateIfsc('HDFC0001234')).toBeNull();
    expect(validateIfsc('hdfc0001234')).toBeNull();
    expect(validateIfsc('HDFC1234')).toBe('Invalid IFSC (e.g. HDFC0001234)');
  });
});

describe('validateRate / validateQty / validateGstRate', () => {
  test('rate >= 0', () => {
    expect(validateRate('')).toBe('Rate required');
    expect(validateRate('abc')).toBe('Rate must be >= 0');
    expect(validateRate('-1')).toBe('Rate must be >= 0');
    expect(validateRate('0')).toBeNull();
    expect(validateRate('99.99')).toBeNull();
  });

  test('qty > 0', () => {
    expect(validateQty('')).toBe('Qty required');
    expect(validateQty('0')).toBe('Qty must be > 0');
    expect(validateQty('-2')).toBe('Qty must be > 0');
    expect(validateQty('1.5')).toBeNull();
  });

  test('gst 0–28', () => {
    expect(validateGstRate(null)).toBe('GST % required');
    expect(validateGstRate(-1)).toBe('GST must be 0–28%');
    expect(validateGstRate(29)).toBe('GST must be 0–28%');
    expect(validateGstRate(0)).toBeNull();
    expect(validateGstRate(18)).toBeNull();
    expect(validateGstRate(28)).toBeNull();
  });
});

describe('gstStateCode', () => {
  test('first two chars uppercased', () => {
    expect(gstStateCode('27ABCDE1234F1Z5')).toBe('27');
    expect(gstStateCode('07abc')).toBe('07');
    expect(gstStateCode('2')).toBeNull();
    expect(gstStateCode('')).toBeNull();
  });
});
