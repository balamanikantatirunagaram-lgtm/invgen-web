import { describe, expect, test } from 'vitest';
import {
  assertActiveIfRequired,
  gstDisplayName,
  parseGstResult,
  readGstCache,
  writeGstCache,
} from '../gstVerify';
import { AppError } from '../../lib/errors';

const SAMPLE = {
  taxpayerInfo: {
    gstin: '27ABCDE1234F1Z5',
    lgnm: 'ACME PRIVATE LIMITED',
    tradeNam: 'Acme Traders',
    sts: 'Active',
    ctb: 'Private Limited Company',
    rgdt: '01/04/2019',
    pradr: {
      addr: {
        bno: '12',
        flno: '3rd Floor',
        bnm: 'Trade House',
        st: 'MG Road',
        loc: 'Camp',
        city: 'Pune',
        dst: 'Pune',
        stcd: 'Maharashtra',
        pncd: '411001',
      },
    },
  },
};

describe('parseGstResult', () => {
  test('normalizes taxpayerInfo + composes address', () => {
    const r = parseGstResult(SAMPLE);
    expect(r.gstin).toBe('27ABCDE1234F1Z5');
    expect(r.legalName).toBe('ACME PRIVATE LIMITED');
    expect(r.tradeName).toBe('Acme Traders');
    expect(r.status).toBe('Active');
    expect(r.constitution).toBe('Private Limited Company');
    expect(r.registrationDate).toBe('01/04/2019');
    expect(r.address).toBe(
      '12, 3rd Floor, Trade House, MG Road, Camp, Pune, Pune, Maharashtra, 411001',
    );
    expect(r.state).toBe('Maharashtra');
    expect(r.pincode).toBe('411001');
    expect(r.district).toBe('Pune');
  });

  test('falls back to root when taxpayerInfo missing', () => {
    const r = parseGstResult({ gstin: 'X', lgnm: 'L', sts: 'Active' });
    expect(r.gstin).toBe('X');
    expect(r.address).toBe('');
  });

  test('skips empty address parts', () => {
    const r = parseGstResult({
      taxpayerInfo: { gstin: 'X', pradr: { addr: { city: 'Pune', pncd: '411001' } } },
    });
    expect(r.address).toBe('Pune, 411001');
  });
});

describe('gstDisplayName', () => {
  test('prefers trade name, falls back to legal', () => {
    expect(gstDisplayName({ tradeName: 'T', legalName: 'L' })).toBe('T');
    expect(gstDisplayName({ tradeName: '', legalName: 'L' })).toBe('L');
  });
});

describe('assertActiveIfRequired', () => {
  test('signup requires Active', () => {
    const active = parseGstResult(SAMPLE);
    expect(() => assertActiveIfRequired(active, true)).not.toThrow();
    expect(() => assertActiveIfRequired(active, false)).not.toThrow();
    const cancelled = { ...active, status: 'Cancelled' };
    expect(() => assertActiveIfRequired(cancelled, false)).not.toThrow();
    expect(() => assertActiveIfRequired(cancelled, true)).toThrow(AppError);
    const blank = { ...active, status: '' };
    expect(() => assertActiveIfRequired(blank, true)).toThrow(/not Active/);
  });
});

describe('gst cache', () => {
  test('write + read round-trip, corrupt/missing → null', () => {
    expect(readGstCache('27ABCDE1234F1Z5')).toBeNull();
    writeGstCache('27ABCDE1234F1Z5', SAMPLE);
    const back = readGstCache('27ABCDE1234F1Z5');
    expect(back?.gstin).toBe('27ABCDE1234F1Z5');
    expect(back?.tradeName).toBe('Acme Traders');
    // Corrupt entry for an uncached key must read as null, never throw.
    expect(readGstCache('DEFINITELY-UNCACHED-KEY')).toBeNull();
  });
});
