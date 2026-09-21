import { beforeEach, describe, expect, test } from 'vitest';
import {
  buildNewInvoice,
  buyerStateCode,
  effectiveUnit,
  emptyItem,
  loadEditState,
  recalcItems,
  sellerStateCode,
  useBuilder,
  validateBuilder,
  type BuilderItem,
} from '../builderStore';
import type { Client, Invoice } from '../../../api/types';
import { docTitleFor } from '../../../pdf/logoUtil';

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: 'c1',
    ownerId: 'u1',
    businessName: 'Acme',
    tradeName: '',
    gstin: '27ABCDE1234F1Z5',
    supplyState: '',
    billingAddress: 'Mumbai',
    shippingAddress: '',
    mobile: '9876543210',
    email: '',
    ...overrides,
  };
}

function item(overrides: Partial<BuilderItem> = {}): BuilderItem {
  return {
    ...emptyItem(),
    name: 'Widget',
    hsnCode: '1001',
    quantity: 10,
    rate: 100,
    gstRate: 18,
    ...overrides,
  };
}

describe('recalcItems', () => {
  test('intra-state splits, totals + words', () => {
    const r = recalcItems([item()], false);
    expect(r.items[0].taxableValue).toBe(1000);
    expect(r.items[0].cgstAmount).toBe(90);
    expect(r.items[0].itemTotal).toBe(1180);
    expect(r.totals.grandTotal).toBe(1180);
    expect(r.amountInWords).toBe('ONE THOUSAND ONE HUNDRED EIGHTY RUPEES ONLY');
  });

  test('toggling interstate recomputes rows', () => {
    const intra = recalcItems([item()], false);
    const inter = recalcItems([item()], true);
    expect(intra.items[0].igstAmount).toBe(0);
    expect(inter.items[0].igstAmount).toBe(180);
    expect(inter.items[0].cgstAmount).toBe(0);
    expect(inter.totals.grandTotal).toBe(1180);
  });
});

describe('effectiveUnit', () => {
  test('custom fallback', () => {
    expect(effectiveUnit({ unit: 'Nos', customUnit: '' })).toBe('Nos');
    expect(effectiveUnit({ unit: 'Custom', customUnit: 'Pair' })).toBe('Pair');
    expect(effectiveUnit({ unit: 'Custom', customUnit: '' })).toBe('Custom');
  });
});

describe('validateBuilder', () => {
  const base = {
    invoiceNumber: 'INV-0001',
    billTo: client(),
    shipTo: null,
    sameAsBillTo: true,
    items: [item()],
  };

  test('valid form passes', () => {
    expect(validateBuilder(base)).toBeNull();
  });

  test('mirrors mobile messages', () => {
    expect(validateBuilder({ ...base, invoiceNumber: '' })).toBe('Invoice number required');
    expect(validateBuilder({ ...base, invoiceNumber: '' }, false)).toBeNull();
    expect(validateBuilder({ ...base, billTo: null })).toBe('Select Bill To client');
    expect(
      validateBuilder({ ...base, sameAsBillTo: false, shipTo: null }),
    ).toBe('Select Ship To client');
    expect(validateBuilder({ ...base, items: [] })).toBe('Add at least one item');
    expect(
      validateBuilder({ ...base, items: [item({ name: '' })] }),
    ).toBe('Row 1: product name required');
    expect(
      validateBuilder({ ...base, items: [item({ quantity: 0 })] }),
    ).toBe('Row 1: qty must be > 0');
    expect(
      validateBuilder({ ...base, items: [item({ quantity: NaN })] }),
    ).toBe('Row 1: qty must be > 0');
  });
});

describe('buildNewInvoice', () => {
  test('maps parties, items, totals; snapshot addresses', () => {
    const bill = client();
    const ship = client({ id: 'c2', businessName: 'Beta', billingAddress: 'Delhi', shippingAddress: '' });
    const r = recalcItems([item()], false);
    const inv = buildNewInvoice(
      {
        invoiceNumber: 'INV-0001',
        invoiceDate: '2026-09-21',
        poNumber: 'PO-1',
        poDate: '',
        vehicleNumber: 'MH01AB1234',
        copyType: 'Original for Recipient',
        template: 'classic',
        billTo: bill,
        shipTo: ship,
        sameAsBillTo: false,
        items: r.items,
        isInterstate: false,
        totals: r.totals,
        amountInWords: r.amountInWords,
      },
      'u1',
      { numberOverride: 'INV-0007' },
    );
    expect(inv.invoiceNumber).toBe('INV-0007');
    expect(inv.billTo.businessName).toBe('Acme');
    expect(inv.shipTo.address).toBe('Delhi'); // empty shipping → billing
    expect(inv.items[0].unit).toBe('Nos');
    expect(inv.grandTotal).toBe(1180);
    expect(inv.status).toBe('issued');
    expect(inv.template).toBe('classic');
    expect(inv.invoiceDate).toEqual(new Date(2026, 8, 21));
    expect(inv.poDate).toBeNull();
  });

  test('sameAsBillTo copies bill party incl. billing address', () => {
    const r = recalcItems([item()], false);
    const bill = client();
    const inv = buildNewInvoice(
      {
        invoiceNumber: 'X',
        invoiceDate: '2026-09-21',
        poNumber: '',
        poDate: '',
        vehicleNumber: '',
        copyType: 'Original for Recipient',
        template: 'classic',
        billTo: bill,
        shipTo: null,
        sameAsBillTo: true,
        items: r.items,
        isInterstate: false,
        totals: r.totals,
        amountInWords: r.amountInWords,
      },
      'u1',
    );
    expect(inv.shipTo.businessName).toBe('Acme');
    expect(inv.shipTo.address).toBe('Mumbai');
  });

  test('throws on invalid (no number required with override)', () => {
    const r = recalcItems([item()], false);
    expect(() =>
      buildNewInvoice(
        {
          invoiceNumber: '',
          invoiceDate: '2026-09-21',
          poNumber: '',
          poDate: '',
          vehicleNumber: '',
          copyType: 'Original for Recipient',
        template: 'classic',
          billTo: null,
          shipTo: null,
          sameAsBillTo: true,
          items: r.items,
          isInterstate: false,
          totals: r.totals,
          amountInWords: r.amountInWords,
        },
        'u1',
        { numberOverride: 'INV-1' },
      ),
    ).toThrow('Select Bill To client');
  });
});

describe('loadEditState', () => {
  function savedInvoice(): Invoice {
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
        businessName: 'Acme',
        gstin: '27ABCDE1234F1Z5',
        address: 'Mumbai',
        mobile: '',
        email: '',
      },
      shipTo: {
        clientId: 'c9',
        businessName: 'Ghost Co',
        gstin: '',
        address: 'Nowhere',
        mobile: '',
        email: '',
      },
      items: [
        {
          name: 'Widget',
          hsnCode: '1001',
          quantity: 2,
          unit: 'Box',
          rate: 50,
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
      subTotal: 100,
      totalTaxableValue: 100,
      totalCGST: 9,
      totalSGST: 9,
      totalIGST: 0,
      roundOff: 0,
      grandTotal: 118,
      amountInWords: '',
      status: 'issued',
      template: 'modern',
      createdAt: null,
      updatedAt: null,
      cancelledAt: null,
    };
  }

  test('resolves live clients, synthesizes snapshot for deleted one', () => {
    const loaded = loadEditState(savedInvoice(), [client()]);
    expect(loaded.billTo?.businessName).toBe('Acme');
    expect(loaded.billTo?.id).toBe('c1');
    // c9 no longer in catalog → snapshot stand-in from denormalized row
    expect(loaded.shipTo?.businessName).toBe('Ghost Co');
    expect(loaded.shipTo?.billingAddress).toBe('Nowhere');
    expect(loaded.sameAsBillTo).toBe(false);
    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0].quantity).toBe(2);
    expect(loaded.items[0].itemTotal).toBe(118); // recomputed
    expect(loaded.status).toBe('issued');
  });

  test('same client both sides → sameAsBillTo', () => {
    const inv = savedInvoice();
    const both = { ...inv, shipTo: { ...inv.billTo } };
    const loaded = loadEditState(both, [client()]);
    expect(loaded.sameAsBillTo).toBe(true);
  });
});

describe('supply-state interstate chain (parity contract)', () => {
  test('GSTIN codes win when present', () => {
    expect(sellerStateCode('27ABCDE1234F1Z5', '')).toBe('27');
    expect(buyerStateCode('07XYZAB1234C1Z2', '')).toBe('07');
  });

  test('supply_state fallback when GSTIN missing', () => {
    expect(sellerStateCode('', '29')).toBe('29');
    expect(buyerStateCode('', '07')).toBe('07');
    expect(sellerStateCode('', '')).toBeNull();
    expect(buyerStateCode('', '')).toBeNull();
  });
});

describe('docTitleFor', () => {
  test('no GSTIN → BILL OF SUPPLY', () => {
    expect(docTitleFor({ gstin: '' })).toBe('BILL OF SUPPLY');
    expect(docTitleFor({ gstin: '  ' })).toBe('BILL OF SUPPLY');
    expect(docTitleFor({ gstin: '27ABCDE1234F1Z5' })).toBe('TAX INVOICE');
  });
});

describe('exempt store mode', () => {
  beforeEach(() => {
    useBuilder.getState().reset();
  });

  test('bindCompanyGstin with exempt zeroes rates and locks interstate', () => {
    const st = useBuilder.getState();
    st.addItemFromProduct({
      id: 'p1',
      name: 'Widget',
      hsnCode: '1001',
      defaultUnit: 'Nos',
      rate: 100,
      gstRate: 18,
    });
    expect(useBuilder.getState().items[0].gstRate).toBe(18);
    st.bindCompanyGstin('', '29', true);
    const s = useBuilder.getState();
    expect(s.isExempt).toBe(true);
    expect(s.isInterstate).toBe(false);
    expect(s.items[0].gstRate).toBe(0);
    expect(s.totals.totalCGST).toBe(0);
    expect(s.totals.grandTotal).toBe(100);
  });

  test('updateItem clamps GST to 0 in exempt mode', () => {
    const st = useBuilder.getState();
    st.bindCompanyGstin('', '29', true);
    const key = useBuilder.getState().items[0].key;
    st.updateItem(key, { gstRate: 18, rate: 200 });
    expect(useBuilder.getState().items[0].gstRate).toBe(0);
    expect(useBuilder.getState().items[0].rate).toBe(200);
  });

  test('setInterstate is a no-op in exempt mode', () => {
    const st = useBuilder.getState();
    st.bindCompanyGstin('', '29', true);
    st.setInterstate(true);
    expect(useBuilder.getState().isInterstate).toBe(false);
  });

  test('exempt interstate auto-detects from supply states', () => {
    const st = useBuilder.getState();
    st.bindCompanyGstin('', '29', false);
    st.setBillTo(client({ gstin: '', supplyState: '07' }));
    // interstateAuto was reset to true by bind (non-exempt) → auto ran
    expect(useBuilder.getState().isInterstate).toBe(true);
    st.setBillTo(client({ gstin: '', supplyState: '29' }));
    expect(useBuilder.getState().isInterstate).toBe(false);
  });
});
