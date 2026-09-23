/**
 * Invoice builder state — TypeScript port of INVGEN-APP
 * `lib/application/controllers/invoice_form_controller.dart`.
 *
 * All math delegates to lib/gst (computeLine/aggregate) + amountWords;
 * this store only maps rows → LineTax → InvoiceTotals. Every mutation
 * recalcs. Saves go through api/invoices (createInvoiceAtomic / update).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  aggregate,
  computeLine,
  detectInterstate,
  type InvoiceTotals,
} from '../../lib/gst';
import { convertAmount } from '../../lib/amountWords';
import { COPY_TYPES, UNITS } from '../../lib/constants';
import type { Client, Invoice, InvoiceTemplate } from '../../api/types';
import type { NewInvoice } from '../../api/invoices';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuilderItem {
  key: string;
  productId: string;
  name: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  customUnit: string;
  rate: number;
  gstRate: number;
  // computed (filled by recalc, never edited directly)
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  itemTotal: number;
}

export function newKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `k-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function emptyItem(): BuilderItem {
  return {
    key: newKey(),
    productId: '',
    name: '',
    hsnCode: '',
    quantity: 1,
    unit: 'Nos',
    customUnit: '',
    rate: 0,
    gstRate: 18,
    taxableValue: 0,
    cgstRate: 0,
    cgstAmount: 0,
    sgstRate: 0,
    sgstAmount: 0,
    igstRate: 0,
    igstAmount: 0,
    itemTotal: 0,
  };
}

export function effectiveUnit(it: Pick<BuilderItem, 'unit' | 'customUnit'>): string {
  return it.unit === 'Custom' && it.customUnit !== '' ? it.customUnit : it.unit;
}

export interface BuilderHeader {
  invoiceNumber: string;
  invoiceDate: string; // yyyy-mm-dd (date input value)
  poNumber: string;
  poDate: string; // yyyy-mm-dd or ''
  vehicleNumber: string;
  copyType: string;
}

export const DEFAULT_COPY_TYPE: string = COPY_TYPES[0];

export function todayInput(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function toInputDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromInputDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// ---------------------------------------------------------------------------
// Pure recalc (unit tested)
// ---------------------------------------------------------------------------

export interface RecalcResult {
  items: BuilderItem[];
  totals: InvoiceTotals;
  amountInWords: string;
}

export function recalcItems(items: BuilderItem[], isInterstate: boolean): RecalcResult {
  const computed = items.map((it) => {
    const line = computeLine({
      quantity: it.quantity,
      rate: it.rate,
      gstRate: it.gstRate,
      isInterstate,
    });
    return {
      ...it,
      taxableValue: line.taxableValue,
      cgstRate: line.cgstRate,
      cgstAmount: line.cgstAmount,
      sgstRate: line.sgstRate,
      sgstAmount: line.sgstAmount,
      igstRate: line.igstRate,
      igstAmount: line.igstAmount,
      itemTotal: line.itemTotal,
    };
  });
  const totals = aggregate(
    computed.map((e) => ({
      taxableValue: e.taxableValue,
      cgstRate: e.cgstRate,
      cgstAmount: e.cgstAmount,
      sgstRate: e.sgstRate,
      sgstAmount: e.sgstAmount,
      igstRate: e.igstRate,
      igstAmount: e.igstAmount,
      itemTotal: e.itemTotal,
    })),
  );
  return { items: computed, totals, amountInWords: convertAmount(totals.grandTotal) };
}

// ---------------------------------------------------------------------------
// Validation (mirrors mobile messages)
// ---------------------------------------------------------------------------

export interface Validatable {
  invoiceNumber: string;
  billTo: Client | null;
  shipTo: Client | null;
  sameAsBillTo: boolean;
  items: Pick<BuilderItem, 'name' | 'quantity' | 'rate'>[];
}

/**
 * [requireNumber]: false when saving via createInvoiceAtomic, where the
 * number is issued by the transaction (form shows a preview).
 */
export function validateBuilder(v: Validatable, requireNumber = true): string | null {
  if (requireNumber && v.invoiceNumber.trim() === '') {
    return 'Invoice number required';
  }
  if (!v.billTo) return 'Select Bill To client';
  const ship = v.sameAsBillTo ? v.billTo : v.shipTo;
  if (!ship) return 'Select Ship To client';
  if (v.items.length === 0) return 'Add at least one item';
  for (let i = 0; i < v.items.length; i++) {
    const it = v.items[i];
    if (it.name.trim() === '') return `Row ${i + 1}: product name required`;
    if (!(it.quantity > 0)) return `Row ${i + 1}: qty must be > 0`;
    if (!(it.rate >= 0)) return `Row ${i + 1}: rate invalid`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Build NewInvoice for repository save
// ---------------------------------------------------------------------------

export interface Buildable extends Validatable {
  invoiceDate: string;
  poNumber: string;
  poDate: string;
  vehicleNumber: string;
  copyType: string;
  isInterstate: boolean;
  items: BuilderItem[];
  totals: InvoiceTotals;
  amountInWords: string;
  template: InvoiceTemplate;
}

function partyFromClient(c: Client, addressOverride?: string) {
  return {
    clientId: c.id,
    businessName: c.businessName,
    gstin: c.gstin,
    address: addressOverride ?? c.billingAddress,
    mobile: c.mobile,
    email: c.email,
  };
}

/**
 * [numberOverride]: when saving via createInvoiceAtomic, the
 * transaction-issued number wins over the form's suggestion display.
 */
export function buildNewInvoice(
  s: Buildable,
  ownerId: string,
  opts: { numberOverride?: string; status?: string } = {},
): NewInvoice {
  const err = validateBuilder(s, opts.numberOverride == null);
  if (err) throw new Error(err);
  const bill = s.billTo as Client;
  const ship = (s.sameAsBillTo ? bill : s.shipTo) as Client;
  return {
    ownerId,
    invoiceNumber: (opts.numberOverride ?? s.invoiceNumber).trim(),
    invoiceDate: fromInputDate(s.invoiceDate),
    poNumber: s.poNumber.trim(),
    poDate: s.poDate === '' ? null : fromInputDate(s.poDate),
    vehicleNumber: s.vehicleNumber.trim(),
    copyType: s.copyType,
    billTo: partyFromClient(bill),
    shipTo: partyFromClient(
      ship,
      s.sameAsBillTo ? bill.billingAddress : ship.shippingAddress === '' ? ship.billingAddress : ship.shippingAddress,
    ),
    items: s.items.map((e) => ({
      name: e.name.trim(),
      hsnCode: e.hsnCode.trim(),
      quantity: e.quantity,
      unit: effectiveUnit(e),
      rate: e.rate,
      taxableValue: e.taxableValue,
      gstRate: e.gstRate,
      cgstRate: e.cgstRate,
      cgstAmount: e.cgstAmount,
      sgstRate: e.sgstRate,
      sgstAmount: e.sgstAmount,
      igstRate: e.igstRate,
      igstAmount: e.igstAmount,
      itemTotal: e.itemTotal,
    })),
    isInterstate: s.isInterstate,
    subTotal: s.totals.subTotal,
    totalTaxableValue: s.totals.totalTaxableValue,
    totalCGST: s.totals.totalCGST,
    totalSGST: s.totals.totalSGST,
    totalIGST: s.totals.totalIGST,
    roundOff: s.totals.roundOff,
    grandTotal: s.totals.grandTotal,
    amountInWords: s.amountInWords,
    status: opts.status ?? 'issued',
    template: s.template,
  };
}

// ---------------------------------------------------------------------------
// Edit loading (mirrors mobile loadForEdit + deleted-client snapshot fallback)
// ---------------------------------------------------------------------------

function snapshotAsClient(p: Invoice['billTo']): Client {
  return {
    id: p.clientId,
    ownerId: '',
    businessName: p.businessName,
    tradeName: '',
    gstin: p.gstin,
    supplyState: '',
    billingAddress: p.address,
    shippingAddress: p.address,
    mobile: p.mobile,
    email: p.email,
  };
}

export interface EditLoaded {
  header: BuilderHeader;
  billTo: Client | null;
  shipTo: Client | null;
  sameAsBillTo: boolean;
  isInterstate: boolean;
  items: BuilderItem[];
  template: InvoiceTemplate;
  status: string;
}

export function loadEditState(inv: Invoice, clients: Client[]): EditLoaded {
  const find = (id: string) => clients.find((c) => c.id === id) ?? null;
  const bill = find(inv.billTo.clientId) ?? snapshotAsClient(inv.billTo);
  const ship = find(inv.shipTo.clientId) ?? snapshotAsClient(inv.shipTo);
  const items = inv.items.map((e) => ({
    ...emptyItem(),
    key: newKey(),
    name: e.name,
    hsnCode: e.hsnCode,
    quantity: e.quantity,
    unit: (UNITS as readonly string[]).includes(e.unit) ? e.unit : 'Custom',
    customUnit: (UNITS as readonly string[]).includes(e.unit) ? '' : e.unit,
    rate: e.rate,
    gstRate: e.gstRate,
  }));
  const { items: computed } = recalcItems(items, inv.isInterstate);
  return {
    header: {
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: toInputDate(inv.invoiceDate),
      poNumber: inv.poNumber,
      poDate: inv.poDate ? toInputDate(inv.poDate) : '',
      vehicleNumber: inv.vehicleNumber,
      copyType: inv.copyType,
    },
    billTo: bill,
    shipTo: ship,
    sameAsBillTo: inv.billTo.clientId === inv.shipTo.clientId,
    isInterstate: inv.isInterstate,
    items: computed,
    template: 'classic',
    status: inv.status,
  };
}

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

interface BuilderStore extends BuilderHeader {
  draftId: string;
  billTo: Client | null;
  shipTo: Client | null;
  sameAsBillTo: boolean;
  isInterstate: boolean;
  interstateAuto: boolean;
  companyGstin: string;
  /** Fallback state code when the company has no GSTIN (exempt mode). */
  companySupplyState: string;
  /** Exempt (Bill of Supply) mode: GST forced 0, interstate hidden. */
  isExempt: boolean;
  items: BuilderItem[];
  totals: InvoiceTotals;
  amountInWords: string;
  template: InvoiceTemplate;
  editStatus: string;

  setHeader: (patch: Partial<BuilderHeader>) => void;
  setBillTo: (c: Client | null) => void;
  setShipTo: (c: Client | null) => void;
  setSameAsBillTo: (v: boolean) => void;
  setTemplate: (t: InvoiceTemplate) => void;
  setInterstate: (v: boolean, auto?: boolean) => void;
  bindCompanyGstin: (g: string, supplyState?: string, exempt?: boolean) => void;
  addItem: () => void;
  addItemFromProduct: (p: { id: string; name: string; hsnCode: string; defaultUnit: string; rate: number; gstRate: number }) => void;
  removeItem: (key: string) => void;
  updateItem: (key: string, patch: Partial<BuilderItem>) => void;
  selectProduct: (key: string, p: { id: string; name: string; hsnCode: string; defaultUnit: string; rate: number; gstRate: number }) => void;
  loadEdit: (loaded: EditLoaded, companyGstin: string, companySupplyState?: string, exempt?: boolean) => void;
  reset: () => void;
}

function initialRecalc() {
  return recalcItems([emptyItem()], false);
}

function applyRecalc(
  set: (p: (s: BuilderStore) => Partial<BuilderStore>) => void,
  mut: (s: BuilderStore) => { items: BuilderItem[]; isInterstate: boolean },
) {
  set((s) => {
    const { items, isInterstate } = mut(s);
    const r = recalcItems(items, isInterstate);
    return { items: r.items, totals: r.totals, amountInWords: r.amountInWords };
  });
}

/**
 * Seller state code: GSTIN first-2 else registered supply_state.
 * Mirrors mobile parity contract (Phase A).
 */
export function sellerStateCode(companyGstin: string, supplyState: string): string | null {
  const g = companyGstin.trim().toUpperCase();
  if (g.length >= 2) return g.slice(0, 2);
  const s = supplyState.trim().toUpperCase();
  return s.length >= 2 ? s.slice(0, 2) : null;
}

/** Buyer state code: GSTIN first-2 else the buyer's supply_state. */
export function buyerStateCode(billGstin: string, supplyState: string): string | null {
  const g = (billGstin ?? '').trim().toUpperCase();
  if (g.length >= 2) return g.slice(0, 2);
  const s = (supplyState ?? '').trim().toUpperCase();
  return s.length >= 2 ? s.slice(0, 2) : null;
}

/** Auto-detect interstate when both sides resolve to a state code. */
function autoInterstate(seller: string | null, buyer: string | null): boolean | null {
  if (!seller || !buyer) return null;
  return detectInterstate(seller, buyer);
}

export const useBuilder = create<BuilderStore>()(
  persist(
    (set) => {
      const init = initialRecalc();
      return {
        draftId: newKey(),
        invoiceNumber: '',
        invoiceDate: todayInput(),
        poNumber: '',
        poDate: '',
        vehicleNumber: '',
        copyType: DEFAULT_COPY_TYPE,
        billTo: null,
        shipTo: null,
        sameAsBillTo: true,
        isInterstate: false,
        interstateAuto: true,
        companyGstin: '',
        companySupplyState: '',
        isExempt: false,
        items: init.items,
        totals: init.totals,
        amountInWords: init.amountInWords,
        template: 'classic',
        editStatus: '',

    setHeader: (patch) => set(() => ({ ...patch })),

    setBillTo: (c) =>
      set((s) => {
        let isInterstate = s.isInterstate;
        if (s.interstateAuto && !s.isExempt) {
          const auto = autoInterstate(
            sellerStateCode(s.companyGstin, s.companySupplyState),
            buyerStateCode(c?.gstin ?? '', c?.supplyState ?? ''),
          );
          if (auto !== null) isInterstate = auto;
        }
        const r = recalcItems(s.items, isInterstate);
        return { billTo: c, isInterstate, items: r.items, totals: r.totals, amountInWords: r.amountInWords };
      }),

    setShipTo: (c) => set(() => ({ shipTo: c })),
    setSameAsBillTo: (v) => set(() => ({ sameAsBillTo: v })),
    setTemplate: (t) => set(() => ({ template: t })),

    setInterstate: (v, auto = false) =>
      set((s) => {
        if (s.isExempt) return {};
        const r = recalcItems(s.items, v);
        return { isInterstate: v, interstateAuto: auto, items: r.items, totals: r.totals, amountInWords: r.amountInWords };
      }),

    bindCompanyGstin: (g, supplyState = '', exempt = false) =>
      set((s) => {
        // Exempt companies have no GST to split: force intra + zero rates.
        const items = exempt ? s.items.map((it) => ({ ...it, gstRate: 0 })) : s.items;
        const isInterstate = false;
        const r = recalcItems(items, false);
        return {
          companyGstin: g,
          companySupplyState: supplyState,
          isExempt: exempt,
          isInterstate,
          interstateAuto: !exempt,
          items: r.items,
          totals: r.totals,
          amountInWords: r.amountInWords,
        };
      }),

    addItem: () =>
      applyRecalc(set, (s) => ({
        items: [...s.items, { ...emptyItem(), gstRate: s.isExempt ? 0 : 18 }],
        isInterstate: s.isInterstate,
      })),

    addItemFromProduct: (p) =>
      applyRecalc(set, (s) => ({
        items: [
          ...s.items,
          {
            ...emptyItem(),
            productId: p.id,
            name: p.name,
            hsnCode: p.hsnCode,
            quantity: 1,
            unit: (UNITS as readonly string[]).includes(p.defaultUnit) ? p.defaultUnit : 'Nos',
            rate: p.rate,
            gstRate: s.isExempt ? 0 : p.gstRate,
          },
        ],
        isInterstate: s.isInterstate,
      })),

    removeItem: (key) =>
      set((s) => {
        if (s.items.length <= 1) return {};
        const r = recalcItems(
          s.items.filter((e) => e.key !== key),
          s.isInterstate,
        );
        return { items: r.items, totals: r.totals, amountInWords: r.amountInWords };
      }),

    updateItem: (key, patch) =>
      applyRecalc(set, (s) => ({
        // Exempt mode clamps any GST edit back to 0.
        items: s.items.map((e) =>
          e.key === key
            ? { ...e, ...patch, gstRate: s.isExempt ? 0 : (patch.gstRate ?? e.gstRate) }
            : e,
        ),
        isInterstate: s.isInterstate,
      })),

    selectProduct: (key, p) =>
      applyRecalc(set, (s) => ({
        items: s.items.map((e) =>
          e.key === key
            ? {
                ...e,
                productId: p.id,
                name: p.name,
                hsnCode: p.hsnCode,
                unit: (UNITS as readonly string[]).includes(p.defaultUnit) ? p.defaultUnit : 'Nos',
                rate: p.rate,
                gstRate: s.isExempt ? 0 : p.gstRate,
              }
            : e,
        ),
        isInterstate: s.isInterstate,
      })),

    loadEdit: (loaded, companyGstin, companySupplyState = '', exempt = false) => {
      const items = exempt ? loaded.items.map((it) => ({ ...it, gstRate: 0 })) : loaded.items;
      const r = recalcItems(items, exempt ? false : loaded.isInterstate);
      set(() => ({
        invoiceNumber: loaded.header.invoiceNumber,
        invoiceDate: loaded.header.invoiceDate,
        poNumber: loaded.header.poNumber,
        poDate: loaded.header.poDate,
        vehicleNumber: loaded.header.vehicleNumber,
        copyType: loaded.header.copyType,
        billTo: loaded.billTo,
        shipTo: loaded.shipTo,
        sameAsBillTo: loaded.sameAsBillTo,
        isInterstate: exempt ? false : loaded.isInterstate,
        interstateAuto: false,
        companyGstin,
        companySupplyState,
        isExempt: exempt,
        items: r.items,
        totals: r.totals,
        amountInWords: r.amountInWords,
        template: loaded.template,
        editStatus: loaded.status,
      }));
    },

    reset: () => {
      const r = initialRecalc();
      set(() => ({
        draftId: newKey(),
        invoiceNumber: '',
        invoiceDate: todayInput(),
        poNumber: '',
        poDate: '',
        vehicleNumber: '',
        copyType: DEFAULT_COPY_TYPE,
        billTo: null,
        shipTo: null,
        sameAsBillTo: true,
        isInterstate: false,
        interstateAuto: true,
        companyGstin: '',
        companySupplyState: '',
        isExempt: false,
        items: r.items,
        totals: r.totals,
        amountInWords: r.amountInWords,
        template: 'classic',
        editStatus: '',
      }));
    },
  };
},
{
  name: 'invgen-builder-draft',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({
    draftId: state.draftId,
    invoiceNumber: state.invoiceNumber,
    invoiceDate: state.invoiceDate,
    poNumber: state.poNumber,
    poDate: state.poDate,
    vehicleNumber: state.vehicleNumber,
    copyType: state.copyType,
    billTo: state.billTo,
    shipTo: state.shipTo,
    sameAsBillTo: state.sameAsBillTo,
    isInterstate: state.isInterstate,
    interstateAuto: state.interstateAuto,
    companyGstin: state.companyGstin,
    companySupplyState: state.companySupplyState,
    isExempt: state.isExempt,
    items: state.items,
    totals: state.totals,
    amountInWords: state.amountInWords,
    template: state.template,
    editStatus: state.editStatus,
  }),
})
);
