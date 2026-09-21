import { describe, expect, test } from 'vitest';
import {
  applyInvoiceFilter,
  clientFromRow,
  clientToRow,
  companyFromRow,
  companyToRow,
  formatInvoiceNumber,
  invoiceFromRow,
  invoiceToRow,
  productFromRow,
  templateFromId,
  userProfileFromRow,
  type Invoice,
} from '../types';
import { AppError, isUniqueViolation, mapSupabase, userMessage } from '../../lib/errors';

describe('formatInvoiceNumber', () => {
  test('pads to 4 digits, defaults empty prefix', () => {
    expect(formatInvoiceNumber('INV-25-26-', 7)).toBe('INV-25-26-0007');
    expect(formatInvoiceNumber('', 7)).toBe('INV-0007');
    expect(formatInvoiceNumber('INV-', 12345)).toBe('INV-12345');
  });
});

describe('templateFromId', () => {
  test('known ids pass through, unknown falls back to classic', () => {
    expect(templateFromId('modern')).toBe('modern');
    expect(templateFromId('nope')).toBe('classic');
    expect(templateFromId(undefined)).toBe('classic');
  });
});

describe('client mappers', () => {
  test('fromRow uppercases GSTIN, toRow omits id', () => {
    const c = clientFromRow(
      {
        id: 'c1',
        owner_id: 'u1',
        business_name: 'Acme',
        trade_name: '',
        gstin: '27abcde1234f1z5',
        billing_address: 'Mumbai',
        shipping_address: '',
        mobile: '9876543210',
        email: '',
      },
      'c1',
    );
    expect(c.gstin).toBe('27ABCDE1234F1Z5');
    const row = clientToRow({ ...c, businessName: 'Acme Pvt' });
    expect(row['business_name']).toBe('Acme Pvt');
    expect('id' in row).toBe(false);
  });
});

describe('product mappers', () => {
  test('unit defaults to Nos, numerics parse from strings', () => {
    const p = productFromRow(
      {
        owner_id: 'u1',
        name: 'Widget',
        hsn_code: '1001',
        default_unit: '',
        rate: '99.5',
        gst_rate: 18,
      },
      'p1',
    );
    expect(p.defaultUnit).toBe('Nos');
    expect(p.rate).toBe(99.5);
  });
});

describe('company mappers', () => {
  test('defaults: signatory, prefix, template', () => {
    const c = companyFromRow(
      {
        company_name: 'Acme',
        address: '',
        gstin: '27abcde1234f1z5',
        mobile: '',
        email: '',
        bank: { bank_name: 'HDFC' },
        terms: ['Pay in 7 days'],
        signatory_label: '',
        invoice_prefix: '',
        invoice_template: 'modern',
      },
      'u1',
    );
    expect(c.signatoryLabel).toBe('Authorised Signatory');
    expect(c.invoicePrefix).toBe('INV-');
    expect(c.invoiceTemplate).toBe('modern');
    expect(c.bankDetails.bankName).toBe('HDFC');
    expect(c.gstin).toBe('27ABCDE1234F1Z5');
    const { id: _id, updatedAt: _updatedAt, ...rowInput } = c;
    void _id;
    void _updatedAt;
    const row = companyToRow(rowInput);
    expect(row['invoice_template']).toBe('modern');
  });
});

describe('profile mappers', () => {
  test('gst booleans and null verifiedAt', () => {
    const p = userProfileFromRow({ email: 'a@b.com', gst_verified: true }, 'u1');
    expect(p.gstVerified).toBe(true);
    expect(p.verifiedAt).toBeNull();
    expect(p.gstin).toBe('');
  });
});

function sampleInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    invoiceId: 'i1',
    ownerId: 'u1',
    invoiceNumber: 'INV-0001',
    invoiceDate: new Date('2026-09-01T00:00:00Z'),
    poNumber: '',
    poDate: null,
    vehicleNumber: '',
    copyType: 'Original for Recipient',
    billTo: {
      clientId: 'c1',
      businessName: 'Acme Corp',
      gstin: '27ABCDE1234F1Z5',
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
    amountInWords: 'ONE THOUSAND ONE HUNDRED EIGHTY RUPEES ONLY',
    status: 'issued',
    createdAt: null,
    updatedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

describe('invoice mappers', () => {
  test('fromRow/toRow round-trip', () => {
    const inv = sampleInvoice();
    const { invoiceId, createdAt, updatedAt, cancelledAt, ...rest } = inv;
    void invoiceId;
    void createdAt;
    void updatedAt;
    void cancelledAt;
    const row = invoiceToRow(rest);
    const back = invoiceFromRow({ ...row, id: 'i1' });
    expect(back.invoiceNumber).toBe('INV-0001');
    expect(back.invoiceDate.toISOString()).toBe(inv.invoiceDate.toISOString());
    expect(back.grandTotal).toBe(1180);
    expect(back.totalTaxableValue).toBe(1000);
    expect(back.billTo.businessName).toBe('Acme Corp');
  });

  test('missing items array defaults to []', () => {
    const inv = invoiceFromRow({ id: 'i1', owner_id: 'u1' });
    expect(inv.items).toEqual([]);
    expect(inv.status).toBe('issued');
    expect(inv.copyType).toBe('Original for Recipient');
  });
});

describe('applyInvoiceFilter', () => {
  const list = [
    sampleInvoice({ invoiceId: 'a', invoiceNumber: 'INV-0001', status: 'issued' }),
    sampleInvoice({
      invoiceId: 'b',
      invoiceNumber: 'INV-0002',
      status: 'paid',
      invoiceDate: new Date('2026-08-01T00:00:00Z'),
      billTo: { ...sampleInvoice().billTo, businessName: 'Beta Ltd' },
    }),
    sampleInvoice({
      invoiceId: 'c',
      invoiceNumber: 'INV-0003',
      status: 'draft',
      invoiceDate: new Date('2026-09-15T00:00:00Z'),
      billTo: { ...sampleInvoice().billTo, businessName: 'Gamma', gstin: '07XYZAB1234C1Z2' },
    }),
  ];

  test('status + query + date range + limit', () => {
    expect(applyInvoiceFilter(list, { status: 'paid' }, 20).map((i) => i.invoiceId)).toEqual(['b']);
    expect(applyInvoiceFilter(list, { query: 'beta' }, 20).map((i) => i.invoiceId)).toEqual(['b']);
    expect(applyInvoiceFilter(list, { query: 'INV-000' }, 20)).toHaveLength(3);
    expect(applyInvoiceFilter(list, { query: '07xyz' }, 20).map((i) => i.invoiceId)).toEqual(['c']);
    expect(
      applyInvoiceFilter(
        list,
        { from: new Date('2026-09-01T00:00:00Z'), to: new Date('2026-09-30T00:00:00Z') },
        20,
      ).map((i) => i.invoiceId),
    ).toEqual(['a', 'c']);
    expect(applyInvoiceFilter(list, {}, 2)).toHaveLength(2);
  });
});

describe('errors', () => {
  test('23505 → conflict; permission codes; network strings', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ code: '42501' })).toBe(false);
    expect(mapSupabase({ code: '23505', message: 'dup' }).kind).toBe('conflict');
    expect(mapSupabase({ code: '42501', message: 'rls' }).kind).toBe('permission');
    expect(mapSupabase(new TypeError('Failed to fetch')).kind).toBe('network');
    const app = AppError.validation('bad');
    expect(mapSupabase(app)).toBe(app);
    expect(userMessage(app)).toBe('bad');
    expect(userMessage(new Error('x'))).toBe('Something went wrong. Try again.');
  });
});
