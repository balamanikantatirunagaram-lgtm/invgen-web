/**
 * Entity types + Supabase row mappers — TypeScript port of INVGEN-APP
 * `lib/data/models/{client,product,company_settings,invoice,invoice_template}.dart`
 * and `UserProfile` in `lib/data/repositories/user_profile_repository.dart`.
 *
 * Column names match the Postgres schema 1:1 so web and mobile share rows.
 */

import {
  isoOrNull,
  rowBool,
  rowDateTime,
  rowDateTimeOrNow,
  rowDouble,
  rowMap,
  rowString,
  rowStringList,
  type Row,
} from '../lib/rows';

// ---------------------------------------------------------------------------
// Invoice templates
// ---------------------------------------------------------------------------

export type BaseLayout = 'classic' | 'modern' | 'minimal' | 'bold' | 'custom_html' | 'agency';

export interface DynamicTemplate {
  id: string;
  name: string;
  base_layout: BaseLayout;
  is_pro: boolean;
  style_config: {
    primaryColor?: string;
    fontFamily?: string;
    [key: string]: any;
  };
}

export type InvoiceTemplate = string;

// For backwards compatibility where arrays were used:
export const INVOICE_TEMPLATES = ['classic', 'modern', 'minimal', 'bold'] as const;

export function templateFromId(id: string | null | undefined): InvoiceTemplate {
  return id || 'classic';
}

// ---------------------------------------------------------------------------
// UserProfile (`profiles`, PK id = auth uid)
// ---------------------------------------------------------------------------

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  gstin: string;
  legalName: string;
  tradeName: string;
  address: string;
  gstVerified: boolean;
  /** Non-GST (Bill of Supply) mode — passes guards without verification. */
  gstExempt: boolean;
  /** Per-user INVGEN PDF watermark flag (admin-controlled). */
  watermarkEnabled: boolean;
  /** Wizard completion (Phase B). Null = not yet onboarded. */
  onboardedAt: Date | null;
  verifiedAt: Date | null;
  verificationStatus: string;
}

export function userProfileFromRow(j: Row, uid: string): UserProfile {
  return {
    uid,
    email: rowString(j['email']),
    displayName: rowString(j['display_name']),
    gstin: rowString(j['gstin']).toUpperCase(),
    legalName: rowString(j['legal_name']),
    tradeName: rowString(j['trade_name']),
    address: rowString(j['address']),
    gstVerified: rowBool(j['gst_verified']),
    gstExempt: rowBool(j['gst_exempt']),
    watermarkEnabled: j['watermark_enabled'] !== false,
    onboardedAt: rowDateTime(j['onboarded_at']),
    verifiedAt: rowDateTime(j['verified_at']),
    verificationStatus: rowString(j['verification_status']),
  };
}

export function userProfileToRow(p: Omit<UserProfile, 'uid' | 'watermarkEnabled'>): Row {
  return {
    email: p.email,
    display_name: p.displayName,
    gstin: p.gstin.toUpperCase(),
    legal_name: p.legalName,
    trade_name: p.tradeName,
    address: p.address,
    gst_verified: p.gstVerified,
    gst_exempt: p.gstExempt,
    onboarded_at: p.onboardedAt?.toISOString() ?? null,
    verified_at: p.verifiedAt?.toISOString() ?? (p.gstVerified ? new Date().toISOString() : null),
    verification_status: p.verificationStatus,
  };
}

// ---------------------------------------------------------------------------
// CompanySettings (`companies`, PK id = auth uid)
// ---------------------------------------------------------------------------

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
}

export const EMPTY_BANK: BankDetails = {
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  branchName: '',
};

export interface CompanySettings {
  id: string;
  companyName: string;
  address: string;
  gstin: string;
  /** 2-digit state code for place-of-supply when no GSTIN exists. */
  supplyState: string;
  mobile: string;
  email: string;
  bankDetails: BankDetails;
  termsAndConditions: string[];
  signatoryLabel: string;
  logoUrl: string;
  /** Base64 JPEG logo (~100KB cap). logoUrl retained dormant for Storage migration. */
  logoBase64: string;
  invoicePrefix: string;
  invoiceTemplate: InvoiceTemplate;
  updatedAt: Date | null;
}

function bankFromRow(j: Row): BankDetails {
  return {
    bankName: rowString(j['bank_name']),
    accountNumber: rowString(j['account_number']),
    ifscCode: rowString(j['ifsc_code']),
    branchName: rowString(j['branch_name']),
  };
}

function bankToRow(b: BankDetails): Row {
  return {
    bank_name: b.bankName,
    account_number: b.accountNumber,
    ifsc_code: b.ifscCode,
    branch_name: b.branchName,
  };
}

export function companyFromRow(j: Row, id: string): CompanySettings {
  const signatory = rowString(j['signatory_label']);
  const prefix = rowString(j['invoice_prefix']);
  return {
    id,
    companyName: rowString(j['company_name']),
    address: rowString(j['address']),
    gstin: rowString(j['gstin']).toUpperCase(),
    supplyState: rowString(j['supply_state']).toUpperCase(),
    mobile: rowString(j['mobile']),
    email: rowString(j['email']),
    bankDetails: bankFromRow(rowMap(j['bank'])),
    termsAndConditions: rowStringList(j['terms']),
    signatoryLabel: signatory === '' ? 'Authorised Signatory' : signatory,
    logoUrl: rowString(j['logo_url']),
    logoBase64: rowString(j['logo_base64']),
    invoicePrefix: prefix === '' ? 'INV-' : prefix,
    invoiceTemplate: templateFromId(rowString(j['invoice_template']) || undefined),
    updatedAt: rowDateTime(j['updated_at']),
  };
}

export function companyToRow(c: Omit<CompanySettings, 'id' | 'updatedAt'>): Row {
  return {
    company_name: c.companyName,
    address: c.address,
    gstin: c.gstin.toUpperCase(),
    supply_state: c.supplyState.toUpperCase(),
    mobile: c.mobile,
    email: c.email,
    bank: bankToRow(c.bankDetails),
    terms: c.termsAndConditions,
    signatory_label: c.signatoryLabel,
    // logo_url dormant (migrated to logo_base64) — stop writing it.
    logo_base64: c.logoBase64,
    invoice_prefix: c.invoicePrefix,
    invoice_template: c.invoiceTemplate,
  };
}

/** Decode embedded logo for PDF rendering. Null when absent/corrupt, never throws. */
export function decodeLogo(base64Str: string): Uint8Array | null {
  if (!base64Str) return null;
  try {
    const bin = atob(base64Str);
    if (!bin) return null;
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Client (`clients`, PK uuid)
// ---------------------------------------------------------------------------

export interface Client {
  id: string;
  ownerId: string;
  businessName: string;
  tradeName: string;
  gstin: string;
  /** 2-digit state code for buyers without GSTIN. */
  supplyState: string;
  billingAddress: string;
  shippingAddress: string;
  mobile: string;
  email: string;
}

/** Effective ship address (fallback to billing). */
export function effectiveShipping(c: Pick<Client, 'billingAddress' | 'shippingAddress'>): string {
  return c.shippingAddress === '' ? c.billingAddress : c.shippingAddress;
}

export function clientFromRow(j: Row, id: string): Client {
  return {
    id,
    ownerId: rowString(j['owner_id']),
    businessName: rowString(j['business_name']),
    tradeName: rowString(j['trade_name']),
    gstin: rowString(j['gstin']).toUpperCase(),
    supplyState: rowString(j['supply_state']).toUpperCase(),
    billingAddress: rowString(j['billing_address']),
    shippingAddress: rowString(j['shipping_address']),
    mobile: rowString(j['mobile']),
    email: rowString(j['email']),
  };
}

export function clientToRow(c: Omit<Client, 'id'>): Row {
  return {
    owner_id: c.ownerId,
    business_name: c.businessName,
    trade_name: c.tradeName,
    gstin: c.gstin.toUpperCase(),
    supply_state: c.supplyState.toUpperCase(),
    billing_address: c.billingAddress,
    shipping_address: c.shippingAddress,
    mobile: c.mobile,
    email: c.email,
    // search_keywords legacy — search uses ilike; column keeps default '{}'.
  };
}

// ---------------------------------------------------------------------------
// ProductCatalog (`products`, PK uuid)
// ---------------------------------------------------------------------------

export interface Product {
  id: string;
  ownerId: string;
  name: string;
  hsnCode: string;
  defaultUnit: string;
  rate: number;
  gstRate: number;
}

export function productFromRow(j: Row, id: string): Product {
  const unit = rowString(j['default_unit']);
  return {
    id,
    ownerId: rowString(j['owner_id']),
    name: rowString(j['name']),
    hsnCode: rowString(j['hsn_code']),
    defaultUnit: unit === '' ? 'Nos' : unit,
    rate: rowDouble(j['rate']),
    gstRate: rowDouble(j['gst_rate']),
  };
}

export function productToRow(p: Omit<Product, 'id'>): Row {
  return {
    owner_id: p.ownerId,
    name: p.name,
    hsn_code: p.hsnCode,
    default_unit: p.defaultUnit,
    rate: p.rate,
    gst_rate: p.gstRate,
  };
}

// ---------------------------------------------------------------------------
// Invoice (`invoices`, PK uuid, UNIQUE(owner_id, invoice_number))
// ---------------------------------------------------------------------------

export interface InvoiceItem {
  name: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  rate: number;
  taxableValue: number;
  gstRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  itemTotal: number;
}

/** Denormalized party snapshot stored inside the invoice. */
export interface InvoiceParty {
  clientId: string;
  businessName: string;
  gstin: string;
  address: string;
  mobile: string;
  email: string;
}

export const EMPTY_PARTY: InvoiceParty = {
  clientId: '',
  businessName: '',
  gstin: '',
  address: '',
  mobile: '',
  email: '',
};

export interface Invoice {
  invoiceId: string;
  ownerId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  poNumber: string;
  poDate: Date | null;
  vehicleNumber: string;
  copyType: string;
  billTo: InvoiceParty;
  shipTo: InvoiceParty;
  items: InvoiceItem[];
  isInterstate: boolean;
  subTotal: number;
  totalTaxableValue: number;
  totalCGST: number;
  totalSGST: number;
  totalDiscount?: number;
  totalIGST: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  status: string;
  /** Per-invoice PDF template (fallback: company default). */
  template: InvoiceTemplate;
  createdAt: Date | null;
  updatedAt: Date | null;
  cancelledAt: Date | null;
}

function partyFromRow(j: Row): InvoiceParty {
  return {
    clientId: rowString(j['client_id']),
    businessName: rowString(j['business_name']),
    gstin: rowString(j['gstin']),
    address: rowString(j['address']),
    mobile: rowString(j['mobile']),
    email: rowString(j['email']),
  };
}

function partyToRow(p: InvoiceParty): Row {
  return {
    client_id: p.clientId,
    business_name: p.businessName,
    gstin: p.gstin,
    address: p.address,
    mobile: p.mobile,
    email: p.email,
  };
}

function itemFromRow(j: Row): InvoiceItem {
  const unit = rowString(j['unit']);
  return {
    name: rowString(j['name']),
    hsnCode: rowString(j['hsn_code']),
    quantity: rowDouble(j['quantity']),
    unit: unit === '' ? 'Nos' : unit,
    rate: rowDouble(j['rate']),
    taxableValue: rowDouble(j['taxable_value']),
    gstRate: rowDouble(j['gst_rate']),
    cgstRate: rowDouble(j['cgst_rate']),
    cgstAmount: rowDouble(j['cgst_amount']),
    sgstRate: rowDouble(j['sgst_rate']),
    sgstAmount: rowDouble(j['sgst_amount']),
    igstRate: rowDouble(j['igst_rate']),
    igstAmount: rowDouble(j['igst_amount']),
    itemTotal: rowDouble(j['item_total']),
  };
}

function itemToRow(e: InvoiceItem): Row {
  return {
    name: e.name,
    hsn_code: e.hsnCode,
    quantity: e.quantity,
    unit: e.unit,
    rate: e.rate,
    taxable_value: e.taxableValue,
    gst_rate: e.gstRate,
    cgst_rate: e.cgstRate,
    cgst_amount: e.cgstAmount,
    sgst_rate: e.sgstRate,
    sgst_amount: e.sgstAmount,
    igst_rate: e.igstRate,
    igst_amount: e.igstAmount,
    item_total: e.itemTotal,
  };
}

export function invoiceFromRow(j: Row): Invoice {
  const rawItems = j['items'];
  const list: Row[] = Array.isArray(rawItems) ? rawItems.map(rowMap) : [];
  const copyType = rowString(j['copy_type']);
  const status = rowString(j['status']);
  return {
    invoiceId: rowString(j['id']),
    ownerId: rowString(j['owner_id']),
    invoiceNumber: rowString(j['invoice_number']),
    invoiceDate: rowDateTimeOrNow(j['invoice_date']),
    poNumber: rowString(j['po_number']),
    poDate: rowDateTime(j['po_date']),
    vehicleNumber: rowString(j['vehicle_number']),
    copyType: copyType === '' ? 'Original for Recipient' : copyType,
    billTo: partyFromRow(rowMap(j['bill_to'])),
    shipTo: partyFromRow(rowMap(j['ship_to'])),
    items: list.map(itemFromRow),
    isInterstate: rowBool(j['is_interstate']),
    subTotal: rowDouble(j['sub_total']),
    totalTaxableValue: rowDouble(j['total_taxable']),
    totalCGST: rowDouble(j['total_cgst']),
    totalSGST: rowDouble(j['total_sgst']),
    totalIGST: rowDouble(j['total_igst']),
    roundOff: rowDouble(j['round_off']),
    grandTotal: rowDouble(j['grand_total']),
    amountInWords: rowString(j['amount_in_words']),
    status: status === '' ? 'issued' : status,
    template: templateFromId(rowString(j['template']) || undefined),
    createdAt: rowDateTime(j['created_at']),
    updatedAt: rowDateTime(j['updated_at']),
    cancelledAt: rowDateTime(j['cancelled_at']),
  };
}

export function invoiceToRow(inv: Omit<Invoice, 'invoiceId' | 'createdAt' | 'updatedAt' | 'cancelledAt'>): Row {
  return {
    owner_id: inv.ownerId,
    invoice_number: inv.invoiceNumber,
    invoice_date: inv.invoiceDate.toISOString(),
    po_number: inv.poNumber,
    po_date: isoOrNull(inv.poDate),
    vehicle_number: inv.vehicleNumber,
    copy_type: inv.copyType,
    bill_to: partyToRow(inv.billTo),
    ship_to: partyToRow(inv.shipTo),
    items: inv.items.map(itemToRow),
    is_interstate: inv.isInterstate,
    sub_total: inv.subTotal,
    total_taxable: inv.totalTaxableValue,
    total_cgst: inv.totalCGST,
    total_sgst: inv.totalSGST,
    total_igst: inv.totalIGST,
    round_off: inv.roundOff,
    grand_total: inv.grandTotal,
    amount_in_words: inv.amountInWords,
    status: inv.status,
    template: inv.template,
    // client_search legacy — search uses ilike; column keeps default ''.
  };
}

// ---------------------------------------------------------------------------
// Ledger filter (same semantics as mobile: one subscription, client-side filter)
// ---------------------------------------------------------------------------

export interface InvoiceFilter {
  from?: Date | null;
  to?: Date | null;
  /** Matches billTo name / gstin / invoice number (case-insensitive). */
  query?: string;
  /** '' = all statuses. */
  status?: string;
}

export function applyInvoiceFilter(
  list: Invoice[],
  filter: InvoiceFilter,
  limit: number,
): Invoice[] {
  let out = [...list].sort((a, b) => {
    const d = b.invoiceDate.getTime() - a.invoiceDate.getTime();
    if (d !== 0) return d;
    return b.invoiceNumber.localeCompare(a.invoiceNumber);
  });
  if (filter.from) {
    const from = filter.from;
    out = out.filter((i) => i.invoiceDate.getTime() >= from.getTime());
  }
  if (filter.to) {
    const to = filter.to;
    out = out.filter((i) => i.invoiceDate.getTime() <= to.getTime());
  }
  if (filter.status) {
    out = out.filter((i) => i.status === filter.status);
  }
  const needle = (filter.query ?? '').trim().toLowerCase();
  if (needle !== '') {
    out = out.filter((i) =>
      `${i.billTo.businessName} ${i.billTo.gstin} ${i.invoiceNumber}`
        .toLowerCase()
        .includes(needle),
    );
  }
  return out.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Quotation (`quotations`, PK uuid, UNIQUE(owner_id, quotation_number))
// ---------------------------------------------------------------------------

export const QUOTATION_STATUSES = ['draft', 'sent', 'accepted', 'converted', 'expired'] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export interface Quotation {
  quotationId: string;
  ownerId: string;
  quotationNumber: string;
  quotationDate: Date;
  validUntil: Date | null;
  billTo: InvoiceParty;
  shipTo: InvoiceParty;
  items: InvoiceItem[];
  isInterstate: boolean;
  subTotal: number;
  totalTaxableValue: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  status: QuotationStatus;
  convertedInvoiceId: string | null;
  template: InvoiceTemplate;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export function quotationFromRow(j: Row): Quotation {
  const rawItems = j['items'];
  const list: Row[] = Array.isArray(rawItems) ? rawItems.map(rowMap) : [];
  const status = rowString(j['status']);
  return {
    quotationId: rowString(j['id']),
    ownerId: rowString(j['owner_id']),
    quotationNumber: rowString(j['quotation_number']),
    quotationDate: rowDateTimeOrNow(j['quotation_date']),
    validUntil: rowDateTime(j['valid_until']),
    billTo: partyFromRow(rowMap(j['bill_to'])),
    shipTo: partyFromRow(rowMap(j['ship_to'])),
    items: list.map(itemFromRow),
    isInterstate: rowBool(j['is_interstate']),
    subTotal: rowDouble(j['sub_total']),
    totalTaxableValue: rowDouble(j['total_taxable']),
    totalCGST: rowDouble(j['total_cgst']),
    totalSGST: rowDouble(j['total_sgst']),
    totalIGST: rowDouble(j['total_igst']),
    roundOff: rowDouble(j['round_off']),
    grandTotal: rowDouble(j['grand_total']),
    amountInWords: rowString(j['amount_in_words']),
    status: (QUOTATION_STATUSES as readonly string[]).includes(status) ? (status as QuotationStatus) : 'draft',
    convertedInvoiceId: rowString(j['converted_invoice_id']) || null,
    template: templateFromId(rowString(j['template']) || undefined),
    createdAt: rowDateTime(j['created_at']),
    updatedAt: rowDateTime(j['updated_at']),
  };
}

export function quotationToRow(q: Omit<Quotation, 'quotationId' | 'createdAt' | 'updatedAt'>): Row {
  return {
    owner_id: q.ownerId,
    quotation_number: q.quotationNumber,
    quotation_date: q.quotationDate.toISOString(),
    valid_until: isoOrNull(q.validUntil),
    bill_to: partyToRow(q.billTo),
    ship_to: partyToRow(q.shipTo),
    items: q.items.map(itemToRow),
    is_interstate: q.isInterstate,
    sub_total: q.subTotal,
    total_taxable: q.totalTaxableValue,
    total_cgst: q.totalCGST,
    total_sgst: q.totalSGST,
    total_igst: q.totalIGST,
    round_off: q.roundOff,
    grand_total: q.grandTotal,
    amount_in_words: q.amountInWords,
    status: q.status,
    converted_invoice_id: q.convertedInvoiceId,
    template: q.template,
  };
}

export type QuotationFilter = InvoiceFilter;

export function applyQuotationFilter(
  list: Quotation[],
  filter: QuotationFilter,
  limit: number,
): Quotation[] {
  let out = [...list].sort((a, b) => {
    const d = b.quotationDate.getTime() - a.quotationDate.getTime();
    if (d !== 0) return d;
    return b.quotationNumber.localeCompare(a.quotationNumber);
  });
  if (filter.from) {
    const from = filter.from;
    out = out.filter((q) => q.quotationDate.getTime() >= from.getTime());
  }
  if (filter.to) {
    const to = filter.to;
    out = out.filter((q) => q.quotationDate.getTime() <= to.getTime());
  }
  if (filter.status) {
    out = out.filter((q) => q.status === filter.status);
  }
  const needle = (filter.query ?? '').trim().toLowerCase();
  if (needle !== '') {
    out = out.filter((q) =>
      `${q.billTo.businessName} ${q.billTo.gstin} ${q.quotationNumber}`
        .toLowerCase()
        .includes(needle),
    );
  }
  return out.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Invoice numbering (mirrors CounterRepository.format)
// ---------------------------------------------------------------------------

/** Format a sequence number, e.g. prefix "INV-25-26-" seq 7 → "INV-25-26-0007". */
export function formatInvoiceNumber(prefix: string, seq: number): string {
  const p = prefix === '' ? 'INV-' : prefix;
  return `${p}${String(seq).padStart(4, '0')}`;
}

/** Format a quotation sequence — e.g. prefix "QUO-" seq 7 → "QUO-0007". */
export function formatQuotationNumber(prefix: string, seq: number): string {
  const p = prefix === '' ? 'QUO-' : prefix;
  return `${p}${String(seq).padStart(4, '0')}`;
}
