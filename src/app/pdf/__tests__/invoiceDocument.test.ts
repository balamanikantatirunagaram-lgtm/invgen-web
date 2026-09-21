import { describe, expect, test } from 'vitest';
import { buildInvoicePdf } from '../buildPdf';
import { docTitleFor, logoDataUrl } from '../logoUtil';
import type { CompanySettings, Invoice, InvoiceItem } from '../../api/types';
import { INVOICE_TEMPLATES } from '../../api/types';

function item(i: number): InvoiceItem {
  return {
    name: `Widget ${i}`,
    hsnCode: '1001',
    quantity: 10,
    unit: 'Nos',
    rate: 100,
    taxableValue: 1000,
    gstRate: 18,
    cgstRate: 9,
    cgstAmount: 90,
    sgstRate: 9,
    sgstAmount: 90,
    igstRate: 0,
    igstAmount: 0,
    itemTotal: 1180,
  };
}

function invoice(nItems: number): Invoice {
  const items = Array.from({ length: nItems }, (_, i) => item(i + 1));
  return {
    invoiceId: 'i1',
    ownerId: 'u1',
    invoiceNumber: 'INV-25-26-0007',
    invoiceDate: new Date('2026-09-21T00:00:00Z'),
    poNumber: 'PO-1',
    poDate: null,
    vehicleNumber: 'MH01AB1234',
    copyType: 'Original for Recipient',
    billTo: {
      clientId: 'c1',
      businessName: 'Acme Corp',
      gstin: '27ABCDE1234F1Z5',
      address: 'Mumbai, Maharashtra',
      mobile: '9876543210',
      email: '',
    },
    shipTo: {
      clientId: 'c1',
      businessName: 'Acme Corp',
      gstin: '27ABCDE1234F1Z5',
      address: 'Mumbai, Maharashtra',
      mobile: '',
      email: '',
    },
    items,
    isInterstate: false,
    subTotal: 1000 * nItems,
    totalTaxableValue: 1000 * nItems,
    totalCGST: 90 * nItems,
    totalSGST: 90 * nItems,
    totalIGST: 0,
    roundOff: 0,
    grandTotal: 1180 * nItems,
    amountInWords: 'TEST RUPEES ONLY',
    status: 'issued',
    template: 'classic',
    createdAt: null,
    updatedAt: null,
    cancelledAt: null,
  };
}

function company(): CompanySettings {
  return {
    id: 'u1',
    companyName: 'Seller Pvt Ltd',
    address: 'Pune, Maharashtra',
    gstin: '27SELLER1234F1Z5',
    supplyState: '',
    mobile: '9123456789',
    email: 'billing@seller.in',
    bankDetails: {
      bankName: 'HDFC Bank',
      accountNumber: '1234567890',
      ifscCode: 'HDFC0001234',
      branchName: 'Pune',
    },
    termsAndConditions: ['Pay within 7 days.', 'E&OE.'],
    signatoryLabel: 'Authorised Signatory',
    logoUrl: '',
    logoBase64: '',
    invoicePrefix: 'INV-',
    invoiceTemplate: 'classic',
    updatedAt: null,
  };
}

describe('logoDataUrl', () => {
  test('empty/corrupt → null', () => {
    expect(logoDataUrl('')).toBeNull();
    expect(logoDataUrl('!!!not-base64!!!')).toBeNull();
  });
});

describe('buildInvoicePdf (golden)', () => {
  test.each(INVOICE_TEMPLATES)('template %s renders non-empty bytes', async (t) => {
    const bytes = await buildInvoicePdf(invoice(2), company(), t);
    expect(bytes.length).toBeGreaterThan(1000);
    // PDF magic header
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
  }, 30000);

  test('50-line invoice paginates without error', async () => {
    const bytes = await buildInvoicePdf(invoice(50), company(), 'classic');
    expect(bytes.length).toBeGreaterThan(1000);
  }, 30000);

  test('inter-state invoice renders', async () => {
    const inv = invoice(1);
    const bytes = await buildInvoicePdf({ ...inv, isInterstate: true }, company(), 'modern');
    expect(bytes.length).toBeGreaterThan(1000);
  }, 30000);

  test('bill of supply renders for exempt company', async () => {
    const co = { ...company(), gstin: '' };
    const bytes = await buildInvoicePdf(invoice(1), co, 'classic', {
      docTitle: docTitleFor(co),
    });
    expect(bytes.length).toBeGreaterThan(1000);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
  }, 30000);
}, 60000);
