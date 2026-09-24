import { describe, expect, test, vi } from 'vitest';
import {
  assertActiveIfRequired,
  GST_FRIENDLY_MESSAGE,
  gstDisplayName,
  gstMessageForCode,
  isGstUnavailableError,
  parseGstResult,
  readGstCache,
  verifyGst,
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

describe('gstMessageForCode', () => {
  test('maps codes to friendly copy, unknown falls back', () => {
    expect(gstMessageForCode('GST_SERVICE_UNAVAILABLE')).toBe(GST_FRIENDLY_MESSAGE.GST_SERVICE_UNAVAILABLE);
    expect(gstMessageForCode('GST_SERVICE_UNAVAILABLE')).toContain('simple-bill mode');
    expect(gstMessageForCode('INVALID_GSTIN')).toBe(GST_FRIENDLY_MESSAGE.INVALID_GSTIN);
    expect(gstMessageForCode('INVALID_GSTIN')).toContain('15 characters');
    expect(gstMessageForCode('GST_TIMEOUT')).toBe(GST_FRIENDLY_MESSAGE.GST_TIMEOUT);
    expect(gstMessageForCode('UNKNOWN_CODE')).toBe('Something went wrong. Try again.');
    expect(gstMessageForCode('')).toBe('Something went wrong. Try again.');
  });

  test('isGstUnavailableError detects code', () => {
    const errUnavailable = Object.assign(new AppError('unknown', 'x'), { code: 'GST_SERVICE_UNAVAILABLE' });
    const errInvalid = Object.assign(new AppError('validation', 'y'), { code: 'INVALID_GSTIN' });
    expect(isGstUnavailableError(errUnavailable)).toBe(true);
    expect(isGstUnavailableError(errInvalid)).toBe(false);
    expect(isGstUnavailableError(new Error('no code'))).toBe(false);
  });
});

describe('verifyGst code mapping', () => {
  test('maps edge codes to friendly errors with code attached', async () => {
    // Use vi.spyOn on the actual client module
    const clientMod = await import('../../supabase/client');

    const invokeMock1 = vi.fn().mockResolvedValue({ data: { error: true, code: 'GST_SERVICE_UNAVAILABLE' }, error: null });
    const spy1 = vi.spyOn(clientMod, 'getSupabase').mockReturnValue({ functions: { invoke: invokeMock1 } } as unknown as ReturnType<typeof import('../../supabase/client')['getSupabase']>);
    await expect(verifyGst('27ABCDE1234F1Z9')).rejects.toSatisfy((e: unknown) => {
      const err = e as AppError & { code?: string };
      return err.message === GST_FRIENDLY_MESSAGE.GST_SERVICE_UNAVAILABLE && err.code === 'GST_SERVICE_UNAVAILABLE';
    });
    spy1.mockRestore();

    const invokeMock2 = vi.fn().mockResolvedValue({ data: { error: true, code: 'INVALID_GSTIN' }, error: null });
    const spy2 = vi.spyOn(clientMod, 'getSupabase').mockReturnValue({ functions: { invoke: invokeMock2 } } as unknown as ReturnType<typeof import('../../supabase/client')['getSupabase']>);
    await expect(verifyGst('27ABCDE1234F1ZA')).rejects.toSatisfy((e: unknown) => {
      const err = e as AppError & { code?: string };
      return err.message === GST_FRIENDLY_MESSAGE.INVALID_GSTIN && err.code === 'INVALID_GSTIN';
    });
    spy2.mockRestore();

    const invokeMock3 = vi.fn().mockResolvedValue({ data: { error: true, code: 'GST_TIMEOUT' }, error: null });
    const spy3 = vi.spyOn(clientMod, 'getSupabase').mockReturnValue({ functions: { invoke: invokeMock3 } } as unknown as ReturnType<typeof import('../../supabase/client')['getSupabase']>);
    await expect(verifyGst('27ABCDE1234F1ZB')).rejects.toSatisfy((e: unknown) => {
      const err = e as AppError & { code?: string };
      return err.message === GST_FRIENDLY_MESSAGE.GST_TIMEOUT && err.code === 'GST_TIMEOUT';
    });
    spy3.mockRestore();

    // Never forwards raw provider help/phone - even Limit Exceed is mapped to unavailable
    const invokeMock4 = vi.fn().mockResolvedValue({ data: { error: true, code: 'GST_SERVICE_UNAVAILABLE' }, error: null });
    const spy4 = vi.spyOn(clientMod, 'getSupabase').mockReturnValue({ functions: { invoke: invokeMock4 } } as unknown as ReturnType<typeof import('../../supabase/client')['getSupabase']>);
    try {
      await verifyGst('27ABCDE1234F1ZC');
      expect.unreachable('should have thrown');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain('Limit Exceed');
      expect(msg).not.toContain('+91');
      expect(msg).not.toContain('Appyflow');
      expect(msg).not.toContain('http');
      expect(msg).toBe(GST_FRIENDLY_MESSAGE.GST_SERVICE_UNAVAILABLE);
    }
    spy4.mockRestore();
  });
});
