import { describe, expect, test } from 'vitest';
import { inflateSync } from 'node:zlib';
import { buildInvoicePdf } from '../buildPdf';
import { EMPTY_PARTY, type CompanySettings, type Invoice } from '../../api/types';

/** Concatenate all (possibly Flate-compressed) content streams as latin1. */
function pdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString('latin1');
  const out: string[] = [];
  const re = /stream\r?\n([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const buf = Buffer.from(m[1], 'latin1');
    try {
      out.push(inflateSync(buf).toString('latin1'));
    } catch {
      out.push(m[1]);
    }
  }
  return out.join('\n');
}

const company: CompanySettings = {
  id: 'c1',
  companyName: 'Acme',
  address: 'Mumbai',
  gstin: '27AAAAA0000A1Z5',
  supplyState: '27',
  mobile: '9999999999',
  email: 'a@b.c',
  bankDetails: { bankName: '', accountNumber: '', ifscCode: '', branchName: '' },
  termsAndConditions: [],
  signatoryLabel: 'Authorised Signatory',
  logoUrl: '',
  logoBase64: '',
  invoicePrefix: 'INV-',
  invoiceTemplate: 'classic',
  updatedAt: null,
};

const inv: Invoice = {
  invoiceId: 'i1',
  ownerId: 'u1',
  invoiceNumber: 'INV-0001',
  invoiceDate: new Date('2026-09-01'),
  poNumber: '',
  poDate: null,
  vehicleNumber: '',
  copyType: 'Original for Recipient',
  billTo: { ...EMPTY_PARTY, businessName: 'Client' },
  shipTo: { ...EMPTY_PARTY, businessName: 'Client' },
  items: [
    {
      name: 'Widget',
      hsnCode: '1234',
      quantity: 1,
      unit: 'Nos',
      rate: 100,
      taxableValue: 100,
      gstRate: 18,
      cgstRate: 9,
      cgstAmount: 9,
      sgstRate: 9,
      sgstAmount: 9,
      igstRate: 0,
      igstAmount: 0,
      itemTotal: 118,
    },
  ],
  isInterstate: false,
  subTotal: 118,
  totalTaxableValue: 100,
  totalCGST: 9,
  totalSGST: 9,
  totalIGST: 0,
  roundOff: 0,
  grandTotal: 118,
  amountInWords: 'One Hundred Eighteen',
  status: 'issued',
  template: 'classic',
  createdAt: null,
  updatedAt: null,
  cancelledAt: null,
};

describe('INVGEN watermark', () => {
  test('classic PDF embeds rotated INVGEN text by default', async () => {
    const bytes = await buildInvoicePdf(inv, company, 'classic');
    const raw = pdfText(bytes);
    // Body text is hex-encoded (possibly kern-split), so match the chunks:
    // 'INV' = 494e56, 'GEN' = 47454e
    expect(raw).toContain('494e56');
    expect(raw).toContain('47454e');
    // rotate(-35°) emits a cos/sin matrix: cos=0.819152, sin=-0.573576
    expect(raw).toContain('0.819152 -0.573576');
  });

  test('watermark:false omits the stamp', async () => {
    const bytes = await buildInvoicePdf(inv, company, 'classic', { watermark: false });
    const raw = pdfText(bytes);
    // Rotation is unique to the watermark painter (invoice number 'INV-0001'
    // shares the 'INV' hex chunk, so the matrix is the real signal).
    expect(raw).not.toContain('0.819152 -0.573576');
  });
});
