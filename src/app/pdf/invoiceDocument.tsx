/**
 * GST Tax Invoice PDF (A4) — TypeScript port of INVGEN-APP
 * `lib/services/pdf/invoice_pdf_service.dart` using @react-pdf/renderer.
 *
 * Four selectable layouts:
 *  - classic : traditional boxed GST form (grey header band, full grid).
 *  - modern  : black header band, logo left, accent rules, boxed meta.
 *  - minimal : clean typographic, no fills/boxes, hairline rules.
 *  - bold    : oversized TAX INVOICE block, strong rules, black totals bar.
 *
 * IMPORTANT: never recomputes tax — renders the already-calculated
 * Invoice totals (single source = lib/gst). Pure black & white palette.
 */
import { Canvas, Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { fmtDate } from '../lib/format';
import {
  type CompanySettings,
  type Invoice,
  type InvoiceParty,
  
} from '../api/types';
import { logoDataUrl } from './logoUtil';

// ---------------------------------------------------------------------------
// Helpers (mirror mobile _m / _d / qty formatting)
// ---------------------------------------------------------------------------

const INK = '#000000';
const PAPER = '#FFFFFF';
const SOFT = '#E8E8E8';
const MID = '#888888';
const GREY400 = '#BDBDBD';
const GREY600 = '#757575';

function m(v: number): string {
  return Number.isFinite(v) ? v.toFixed(2) : '0.00';
}

function d(dt: Date | null | undefined): string {
  return !dt || Number.isNaN(dt.getTime()) ? '-' : fmtDate(dt);
}

function qtyStr(q: number): string {
  if (!Number.isFinite(q)) return '-';
  return Number.isInteger(q) ? String(q) : q.toFixed(2);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: { padding: 24, fontFamily: 'Helvetica', color: INK, backgroundColor: PAPER },
  footerFixed: {
    position: 'absolute',
    bottom: 12,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: MID },
  badge: { borderWidth: 0.6, borderColor: INK, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 7, fontWeight: 'bold' },
  gstinLine: { fontSize: 7 },
  issuerName: { fontSize: 13, fontWeight: 'bold' },
  issuerAddr: { fontSize: 8.5 },
  issuerContact: { fontSize: 8 },
  partyTitle: { fontSize: 9, fontWeight: 'bold' },
  partyName: { fontSize: 9, fontWeight: 'bold' },
  partyLine: { fontSize: 8 },
  kvKey: { fontSize: 8, color: MID, width: 78 },
  kvVal: { fontSize: 8.5, fontWeight: 'bold', flex: 1 },
  sectionTitle: { fontSize: 9, fontWeight: 'bold' },
  smallBold: { fontSize: 8.5, fontWeight: 'bold' },
  small: { fontSize: 8 },
  tiny: { fontSize: 7.5 },
  cell: { fontSize: 7.5 },
});

const FLEX: number[] = [0.5, 2.4, 0.9, 0.9, 1, 1, 1, 1, 1];
const FLEX_NOTAX: number[] = [0.5, 3.4, 1, 1.2, 1.2];

/** True when the invoice carries any GST — otherwise render a clean tax-free bill. */
export function hasTax(inv: Invoice): boolean {
  return (inv.totalCGST || 0) + (inv.totalSGST || 0) + (inv.totalIGST || 0) > 0;
}

function rowStrings(inv: Invoice, showTax: boolean): string[][] {
  return inv.items.map((it, i) => {
    const base = [
      `${i + 1}`,
      `${it.name}\nHSN: ${it.hsnCode === '' ? '-' : it.hsnCode}`,
      `${qtyStr(it.quantity)}\n${it.unit}`,
      m(it.rate),
    ];
    if (!showTax) return [...base, m(it.itemTotal)];
    return [
      ...base,
      m(it.taxableValue),
      `${Number.isFinite(it.cgstRate) ? it.cgstRate.toFixed(1) : '0.0'}%\n${m(it.cgstAmount)}`,
      `${Number.isFinite(it.sgstRate) ? it.sgstRate.toFixed(1) : '0.0'}%\n${m(it.sgstAmount)}`,
      `${Number.isFinite(it.igstRate) ? it.igstRate.toFixed(1) : '0.0'}%\n${m(it.igstAmount)}`,
      m(it.itemTotal),
    ];
  });
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function PageHeader({
  inv,
  company,
  templateDef,
  docTitle,
}: {
  inv: Invoice;
  company: CompanySettings;
  templateDef: import("../api/types").DynamicTemplate;
  docTitle: string;
}) {
  const badge = (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{inv.copyType}</Text>
    </View>
  );
  const gstin =
    company.gstin === '' ? null : (
      <Text style={styles.gstinLine}>GSTIN: {company.gstin}</Text>
    );

  if (templateDef.base_layout === 'bold') {
    return (
      <View>
        <View style={{ backgroundColor: INK, paddingVertical: 10 }}>
          <Text style={{ fontSize: 26, color: PAPER, letterSpacing: 4, fontWeight: 'bold', textAlign: 'center' }}>
            {docTitle}
          </Text>
        </View>
        <View style={{ height: 4 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {gstin}
          {badge}
        </View>
        <View style={{ height: 2 }} />
      </View>
    );
  }

  if (templateDef.base_layout === 'modern') {
    return (
      <View>
        <View style={{ borderBottomWidth: 2, borderBottomColor: INK, paddingBottom: 4, flexDirection: 'row', alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 12, fontWeight: 'bold' }}>
            {company.companyName === '' ? docTitle : company.companyName}
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 11, fontWeight: 'bold' }}>{docTitle}</Text>
        </View>
        <View style={{ height: 3 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {gstin}
          {badge}
        </View>
        <View style={{ height: 2 }} />
      </View>
    );
  }

  // classic + minimal
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {gstin}
        {badge}
      </View>
      <View style={{ height: 2 }} />
      <Text
        style={{
          fontSize: templateDef.base_layout === 'minimal' ? 13 : 16,
          letterSpacing: templateDef.base_layout === 'minimal' ? 3 : 0,
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        {docTitle}
      </Text>
      <View style={{ borderBottomWidth: templateDef.base_layout === 'minimal' ? 0.5 : 1, borderBottomColor: INK, marginTop: 4 }} />
    </View>
  );
}

function IssuerBlock({
  company,
  logoSrc,
  templateDef,
}: {
  company: CompanySettings;
  logoSrc: string | null;
  templateDef: import("../api/types").DynamicTemplate;
}) {
  const isModern = templateDef.base_layout === 'modern';
  const contactParts: string[] = [];
  if (company.gstin !== '') contactParts.push(`GSTIN: ${company.gstin}`);
  if (company.mobile !== '') contactParts.push(`Mobile: ${company.mobile}`);
  if (company.email !== '') contactParts.push(`Email: ${company.email}`);
  const contactLine = contactParts.join(' - ');
  const row = (
    <View style={{ flexDirection: 'row' }}>
      {logoSrc && (
        <View style={{ flexDirection: 'row' }}>
          <Image src={logoSrc} style={{ width: isModern ? 64 : 56, height: isModern ? 64 : 56, objectFit: 'contain' }} />
          <View style={{ width: 10 }} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        {(!isModern || company.companyName === '') && (
          <Text style={styles.issuerName}>{company.companyName}</Text>
        )}
        <Text style={styles.issuerAddr}>{company.address}</Text>
        {contactLine !== '' && <Text style={styles.issuerContact}>{contactLine}</Text>}
      </View>
    </View>
  );

  if (templateDef.base_layout === 'classic') {
    return (
      <View style={{ backgroundColor: SOFT, borderWidth: 0.5, borderColor: MID, padding: 8 }}>
        {row}
      </View>
    );
  }
  return row;
}

function Party({ title, p, templateDef }: { title: string; p: InvoiceParty; templateDef: import("../api/types").DynamicTemplate }) {
  return (
    <View>
      <Text style={styles.partyTitle}>{title}</Text>
      {templateDef.base_layout === 'modern' && (
        <View style={{ width: 28, height: 2, backgroundColor: INK, marginTop: 2, marginBottom: 3 }} />
      )}
      <Text style={styles.partyName}>{p.businessName}</Text>
      <Text style={styles.partyLine}>{p.address}</Text>
      {p.gstin !== '' && <Text style={styles.partyLine}>GSTIN: {p.gstin}</Text>}
      {p.mobile !== '' && <Text style={styles.partyLine}>Mobile: {p.mobile}</Text>}
    </View>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={styles.kvVal}>{v}</Text>
    </View>
  );
}

function PartiesAndMeta({ inv, templateDef, docTitle }: { inv: Invoice; templateDef: import("../api/types").DynamicTemplate; docTitle: string }) {
  const showTax = hasTax(inv);
  const isQuotation = docTitle.toLowerCase().includes('quotation');
  const noLabel = isQuotation ? 'Quotation No' : 'Invoice No';
  const dateLabel = isQuotation ? 'Quotation Date' : 'Invoice Date';
  const meta = (
    <View>
      <Kv k={noLabel} v={inv.invoiceNumber} />
      <Kv k={dateLabel} v={d(inv.invoiceDate)} />
      {isQuotation && (inv as any).validUntil !== undefined ? null : null}
      {inv.poNumber !== '' && <Kv k="PO No" v={inv.poNumber} />}
      {inv.poDate && <Kv k="PO Date" v={d(inv.poDate)} />}
      {inv.vehicleNumber !== '' && <Kv k="Vehicle No" v={inv.vehicleNumber} />}
      <Kv
        k="Supply"
        v={showTax ? (inv.isInterstate ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)') : 'Bill of Supply (no GST)'}
      />
    </View>
  );
  // Quotation validUntil if present (poDate holds validUntil for quotations)
  const validUntil = isQuotation ? (inv as any).poDate as Date | null : null;
  const metaWithValid = (
    <View>
      {meta}
      {isQuotation && validUntil && <Kv k="Valid Until" v={d(validUntil)} />}
    </View>
  );
  const boxedContent = templateDef.base_layout === 'minimal' ? metaWithValid : (
    <View style={{ padding: 8, borderWidth: templateDef.base_layout === 'modern' ? 0.8 : 0.5, borderColor: templateDef.base_layout === 'modern' ? INK : MID }}>
      {metaWithValid}
    </View>
  );
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ flex: 3 }}>
        <Party title="Bill To" p={inv.billTo} templateDef={templateDef} />
        <View style={{ height: 6 }} />
        <Party title="Ship To" p={inv.shipTo} templateDef={templateDef} />
      </View>
      <View style={{ width: 12 }} />
      <View style={{ flex: 2 }}>{boxedContent}</View>
    </View>
  );
}

function ItemsTable({ inv, templateDef }: { inv: Invoice; templateDef: import("../api/types").DynamicTemplate }) {
  const showTax = hasTax(inv);
  const headers = showTax
    ? ['Sl', 'Description\nHSN', 'Qty\nUnit', 'Rate', 'Taxable', 'CGST\nRt/Amt', 'SGST\nRt/Amt', 'IGST\nRt/Amt', 'Total']
    : ['Sl', 'Description\nHSN', 'Qty\nUnit', 'Rate', 'Amount'];
  const rows = rowStrings(inv, showTax);
  const flex = showTax ? FLEX : FLEX_NOTAX;
  const darkHeader = templateDef.base_layout === 'modern' || templateDef.base_layout === 'bold';
  const fillHeader = templateDef.base_layout !== 'minimal';

  const borderColor = templateDef.style_config?.primaryColor || (templateDef.base_layout === 'classic' ? GREY600 : INK);
  const borderWidth = templateDef.base_layout === 'bold' ? 0.8 : 0.5;

  const cellBorder =
    templateDef.base_layout === 'minimal'
      ? { borderBottomWidth: 0.3, borderBottomColor: SOFT }
      : { borderRightWidth: borderWidth, borderRightColor: borderColor };

  const aligns: ('center' | 'left' | 'right')[] = showTax
    ? ['center', 'left', 'center', 'right', 'right', 'right', 'right', 'right', 'right']
    : ['center', 'left', 'center', 'right', 'right'];

  return (
    <View
      style={{
        borderWidth: templateDef.base_layout === 'minimal' ? 0 : borderWidth,
        borderColor,
        borderTopWidth: templateDef.base_layout === 'minimal' ? 0.7 : borderWidth,
        borderTopColor: templateDef.base_layout === 'minimal' ? INK : borderColor,
        borderBottomWidth: templateDef.base_layout === 'minimal' ? 0.7 : borderWidth,
        borderBottomColor: templateDef.base_layout === 'minimal' ? INK : borderColor,
      }}
    >
      {/* header */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: !fillHeader ? undefined : darkHeader ? (templateDef.style_config?.primaryColor || INK) : SOFT,
          borderBottomWidth: templateDef.base_layout === 'minimal' ? 0 : borderWidth,
          borderBottomColor: borderColor,
        }}
      >
        {headers.map((h, i) => (
          <View
            key={h}
            style={{ flex: flex[i], padding: 4, alignItems: aligns[i] === 'center' ? 'center' : aligns[i] === 'right' ? 'flex-end' : 'flex-start' }}
          >
            <Text style={{ fontSize: 7.5, fontWeight: 'bold', color: darkHeader && fillHeader ? PAPER : INK, textAlign: aligns[i] }}>
              {h}
            </Text>
          </View>
        ))}
      </View>
      {/* rows */}
      {rows.map((r, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }} wrap={false}>
          {r.map((cell, i) => (
            <View
              key={i}
              style={{
                flex: flex[i],
                padding: 4,
                ...cellBorder,
                ...(i === r.length - 1 ? { borderRightWidth: 0 } : {}),
                alignItems: aligns[i] === 'center' ? 'center' : aligns[i] === 'right' ? 'flex-end' : 'flex-start',
              }}
            >
              <Text style={{ ...styles.cell, textAlign: aligns[i] }}>{cell}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function SectionTitle({ text, templateDef }: { text: string; templateDef: import("../api/types").DynamicTemplate }) {  return (
    <View style={{ marginBottom: 2 }}>
      <Text style={{ ...styles.sectionTitle, letterSpacing: templateDef.base_layout === 'minimal' ? 1.5 : 0 }}>
        {text}
      </Text>
      {templateDef.base_layout === 'modern' && (
        <View style={{ width: 24, height: 1.5, backgroundColor: INK, marginTop: 2, marginBottom: 3 }} />
      )}
    </View>
  );
}

function FooterSplit({
  inv,
  company,
  templateDef,
}: {
  inv: Invoice;
  company: CompanySettings;
  templateDef: import("../api/types").DynamicTemplate;
}) {
  const boldGrand = templateDef.base_layout === 'bold';
  const rowBorder = templateDef.base_layout === 'minimal' ? SOFT : GREY400;
  const showTax = hasTax(inv);

  const totalRow = (label: string, value: string, bold: boolean, bg?: string, fg?: string) => (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: bg,
        borderBottomWidth: 0.5,
        borderBottomColor: rowBorder,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 8.5, color: fg ?? INK, fontWeight: bold ? 'bold' : 'normal' }}>
          {label}
        </Text>
        <Text style={{ fontSize: bold ? 10 : 8.5, color: fg ?? INK, fontWeight: bold ? 'bold' : 'normal' }}>
          {value}
        </Text>
      </View>
    </View>
  );

  const totals = (
    <View>
      <View
        style={{
          borderWidth: templateDef.base_layout === 'minimal' ? 0 : boldGrand ? 1 : 0.5,
          borderColor: INK,
          borderTopWidth: templateDef.base_layout === 'minimal' ? 0.8 : boldGrand ? 1 : 0.5,
          borderTopColor: INK,
        }}
      >
        {showTax && totalRow('Taxable Value', m(inv.totalTaxableValue), false)}
        {showTax && totalRow('CGST', m(inv.totalCGST), false)}
        {showTax && totalRow('SGST', m(inv.totalSGST), false)}
        {showTax && totalRow('IGST', m(inv.totalIGST), false)}
        {!showTax && totalRow('Subtotal', m(inv.totalTaxableValue), false)}
        {Number.isFinite(inv.roundOff) && Math.abs(inv.roundOff) >= 0.005 && totalRow('Round Off', inv.roundOff.toFixed(2), false)}
        {totalRow(
          'Grand Total',
          `Rs. ${m(inv.grandTotal)}`,
          true,
          boldGrand ? INK : templateDef.base_layout === 'classic' ? SOFT : undefined,
          boldGrand ? PAPER : undefined,
        )}
      </View>
      <View style={{ height: 16 }} />
      <Text style={{ fontSize: 9, fontWeight: 'bold' }}>For {company.companyName}</Text>
      <View style={{ height: 48 }} />
      <Text style={{ fontSize: 8.5 }}>{company.signatoryLabel}</Text>
      <Text style={{ fontSize: 7, color: MID }}>(Authorised Signatory)</Text>
    </View>
  );

  const bank = company.bankDetails;
  const hasBank = bank.accountNumber !== '' || bank.bankName !== '' || bank.ifscCode !== '' || bank.branchName !== '';
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ flex: 3 }}>
        {hasBank && (
          <>
            <SectionTitle text="Bank Details" templateDef={templateDef} />
            <Text style={styles.small}>
              {[bank.accountNumber && `A/c: ${bank.accountNumber}`, bank.bankName && `Bank: ${bank.bankName}`, bank.branchName && `Branch: ${bank.branchName}`, bank.ifscCode && `IFSC: ${bank.ifscCode}`].filter(Boolean).join(' - ')}
            </Text>
          </>
        )}
        <View style={{ height: 6 }} />
        <SectionTitle text="Amount in Words" templateDef={templateDef} />
        <Text style={styles.smallBold}>{inv.amountInWords}</Text>
        <View style={{ height: 6 }} />
        <SectionTitle text="Terms & Conditions" templateDef={templateDef} />
        {company.termsAndConditions.map((t, i) => (
          <Text key={i} style={styles.tiny}>
            {i + 1}. {t}
          </Text>
        ))}
      </View>
      <View style={{ width: 12 }} />
      <View style={{ flex: 2 }}>{totals}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Document + builder
// ---------------------------------------------------------------------------

/**
 * INVGEN watermark, bottom-right of every page of both layout branches.
 * NOTE: View/Text styles do NOT support `transform` in @react-pdf/renderer —
 * rotation must go through a Canvas painter (verified against v4 render API).
 */
function Watermark() {
  return (
    <Canvas
      fixed
      style={{ position: 'absolute', top: 0, left: 0, width: 595, height: 842 }}
      paint={(p, w, h) => {
        p.save()
          .translate(w - 150, h - 130)
          .rotate(-35)
          .font('Helvetica-Bold')
          .fontSize(72)
          .fillColor('#808080')
          .fillOpacity(0.22)
          .text('INVGEN', -190, -26)
          .restore();
        return null;
      }}
    />
  );
}

export function InvoiceDocument({
  inv,
  company,
  templateDef,
  docTitle = 'TAX INVOICE',
  watermark = true,
}: {
  inv: Invoice;
  company: CompanySettings;
  templateDef: import("../api/types").DynamicTemplate;
  /** Header title — 'TAX INVOICE' normally, 'BILL OF SUPPLY' when exempt. */
  docTitle?: string;
  /** INVGEN watermark; resolved from global + per-user flags by callers. */
  watermark?: boolean;
}) {
  
  const logoSrc = logoDataUrl(company.logoBase64);
  const today = fmtDate(new Date());


  if (templateDef.base_layout === 'agency') {
    const m = (val: any) => Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    
    return (
      <Document title={`${docTitle} ${inv.invoiceNumber}`}>
        <Page size="A4" style={{ backgroundColor: '#ffffff', padding: 40, position: 'relative' }}>
          {watermark && <Watermark />}
          {/* Background decorative circles */}
          <View style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: '#eef2ff' }} />
          <View style={{ position: 'absolute', top: -15, right: -15, width: 85, height: 85, borderRadius: 50, backgroundColor: '#667eea', opacity: 0.9 }} />

          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', zIndex: 1, marginBottom: 40, marginTop: 25 }}>
            <View>
              {/* Logo / Brand Name */}
              {logoSrc ? (
                <Image src={logoSrc} style={{ height: 60, width: 180, objectFit: 'contain', objectPositionX: 'left', marginBottom: 8 }} />
              ) : (
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#0f172a', letterSpacing: -1 }}>{company.companyName}</Text>
              )}
              <Text style={{ fontSize: 11, color: '#64748b' }}>Invoices made simple.</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: 1, color: '#526585', marginBottom: 12 }}>SIMPLE • FAST • PROFESSIONAL</Text>
              <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#0f172a', letterSpacing: -1, marginBottom: 16 }}>INVOICE</Text>
              <View style={{ flexDirection: 'row', gap: 15 }}>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 10, color: '#334155' }}>Invoice No.</Text>
                  <Text style={{ fontSize: 10, color: '#334155' }}>Issue Date</Text>
                </View>
                <View style={{ gap: 4, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#111827' }}>{inv.invoiceNumber}</Text>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#111827' }}>{today}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Billing */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 }}>
            <View style={{ flex: 1, paddingRight: 20 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5, color: '#526585', marginBottom: 8 }}>FROM</Text>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#111827', marginBottom: 4 }}>{company.companyName}</Text>
              {company.address ? <Text style={{ fontSize: 10, color: '#334155', lineHeight: 1.4 }}>{company.address}</Text> : null}
              {company.mobile ? <Text style={{ fontSize: 10, color: '#334155', lineHeight: 1.4 }}>{company.mobile}</Text> : null}
              {company.email ? <Text style={{ fontSize: 10, color: '#334155', lineHeight: 1.4 }}>{company.email}</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5, color: '#526585', marginBottom: 8 }}>BILL TO</Text>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#111827', marginBottom: 4 }}>{inv.billTo?.businessName || inv.shipTo?.businessName || 'Client'}</Text>
              <Text style={{ fontSize: 10, color: '#334155', lineHeight: 1.4 }}>{inv.billTo?.address || inv.shipTo?.address || ''}</Text>
              <Text style={{ fontSize: 10, color: '#334155', lineHeight: 1.4 }}>{inv.billTo?.mobile || inv.shipTo?.mobile || ''}</Text>
            </View>
          </View>

          {/* Items */}
          <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 25 }}>
            <View style={{ flexDirection: 'row', backgroundColor: '#f1f4f9', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: 10 }}>
              <Text style={{ width: '8%', fontSize: 9, fontWeight: 'bold', color: '#172033', letterSpacing: 1 }}>#</Text>
              <Text style={{ flex: 1, fontSize: 9, fontWeight: 'bold', color: '#172033', letterSpacing: 1 }}>DESCRIPTION</Text>
              <Text style={{ width: '12%', textAlign: 'center', fontSize: 9, fontWeight: 'bold', color: '#172033', letterSpacing: 1 }}>QTY</Text>
              <Text style={{ width: '18%', textAlign: 'right', fontSize: 9, fontWeight: 'bold', color: '#172033', letterSpacing: 1 }}>RATE</Text>
              <Text style={{ width: '18%', textAlign: 'right', fontSize: 9, fontWeight: 'bold', color: '#172033', letterSpacing: 1 }}>AMOUNT</Text>
            </View>
            {(inv.items || []).map((it, i) => (
              <View key={i} style={{ flexDirection: 'row', padding: 10, borderBottomWidth: i === (inv.items?.length || 0) - 1 ? 0 : 1, borderBottomColor: '#e2e8f0' }}>
                <Text style={{ width: '8%', fontSize: 9, color: '#1e293b' }}>{i + 1}</Text>
                <Text style={{ flex: 1, fontSize: 9, color: '#1e293b' }}>{it.name || 'Item'}</Text>
                <Text style={{ width: '12%', textAlign: 'center', fontSize: 9, color: '#1e293b' }}>{it.quantity}</Text>
                <Text style={{ width: '18%', textAlign: 'right', fontSize: 9, color: '#1e293b' }}>{m(it.rate)}</Text>
                <Text style={{ width: '18%', textAlign: 'right', fontSize: 9, color: '#1e293b' }}>{m(it.itemTotal)}</Text>
              </View>
            ))}
          </View>

          {/* Summary */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 }}>
            <View style={{ width: '55%', backgroundColor: '#f4f6fb', padding: 15, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#4f7cff' }}>
              <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>Thank you for choosing us!</Text>
              <Text style={{ fontSize: 9, color: '#64748b' }}>We appreciate your business and support.</Text>
            </View>
            <View style={{ width: '40%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ fontSize: 10, color: '#334155' }}>Subtotal</Text>
                <Text style={{ fontSize: 10, color: '#334155' }}>Rs. {m(inv.subTotal || 0)}</Text>
              </View>
              {(inv.totalDiscount || 0) > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ fontSize: 10, color: '#334155' }}>Discount</Text>
                  <Text style={{ fontSize: 10, color: '#334155' }}>-Rs. {m(inv.totalDiscount)}</Text>
                </View>
              )}
              {((inv.totalCGST || 0) + (inv.totalSGST || 0) + (inv.totalIGST || 0)) > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ fontSize: 10, color: '#334155' }}>Tax</Text>
                  <Text style={{ fontSize: 10, color: '#334155' }}>Rs. {m((inv.totalCGST || 0) + (inv.totalSGST || 0) + (inv.totalIGST || 0))}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#edf2ff', borderRadius: 8, marginTop: 6, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#111827' }}>Grand Total</Text>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#111827' }}>Rs. {m(inv.grandTotal || 0)}</Text>
              </View>
            </View>
          </View>

          {/* Payment & Notes */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 }}>
            <View style={{ width: '48%' }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5, color: '#526585', marginBottom: 8 }}>PAYMENT DETAILS</Text>
              <View style={{ backgroundColor: '#f5f7fb', padding: 14, borderRadius: 8 }}>
                {company.bankDetails?.bankName ? (
                  <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                    <Text style={{ width: 80, fontSize: 9, color: '#334155' }}>Bank Name</Text>
                    <Text style={{ flex: 1, fontSize: 9, color: '#1e293b', fontWeight: 'bold' }}>{company.bankDetails.bankName}</Text>
                  </View>
                ) : null}
                {company.bankDetails?.accountNumber ? (
                  <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                    <Text style={{ width: 80, fontSize: 9, color: '#334155' }}>A/C Number</Text>
                    <Text style={{ flex: 1, fontSize: 9, color: '#1e293b', fontWeight: 'bold' }}>{company.bankDetails.accountNumber}</Text>
                  </View>
                ) : null}
                {company.bankDetails?.ifscCode ? (
                  <View style={{ flexDirection: 'row' }}>
                    <Text style={{ width: 80, fontSize: 9, color: '#334155' }}>IFSC Code</Text>
                    <Text style={{ flex: 1, fontSize: 9, color: '#1e293b', fontWeight: 'bold' }}>{company.bankDetails.ifscCode}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={{ width: '48%' }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5, color: '#526585', marginBottom: 8 }}>NOTES</Text>
              <View style={{ backgroundColor: '#f5f7fb', padding: 14, borderRadius: 8 }}>
                {(company.termsAndConditions || []).map((t: string, i: number) => (
                  <Text key={i} style={{ fontSize: 9, color: '#334155', marginBottom: 4 }}>• {t}</Text>
                ))}
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', position: 'absolute', bottom: 40, left: 40, right: 40 }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#111827' }}>Let's build something amazing together.</Text>
              <View style={{ width: 50, height: 2, backgroundColor: '#3267ff', marginTop: 8, borderRadius: 2 }} />
            </View>
            <View style={{ alignItems: 'center' }}>
              <View style={{ height: 1, width: 120, backgroundColor: '#64748b', marginBottom: 6 }} />
              <Text style={{ fontSize: 9, color: '#64748b' }}>{company.signatoryLabel || 'Authorized Signature'}</Text>
            </View>
          </View>
        </Page>
      </Document>
    );
  }

  
  return (
    <Document title={`${docTitle} ${inv.invoiceNumber}`}>
      <Page size="A4" style={styles.page}>
        {watermark && <Watermark />}
        <PageHeader inv={inv} company={company} templateDef={templateDef} docTitle={docTitle} />
        <View style={{ height: 8 }} />
        <IssuerBlock company={company} logoSrc={logoSrc} templateDef={templateDef} />
        <View style={{ height: 8 }} />
        <PartiesAndMeta inv={inv} templateDef={templateDef} docTitle={docTitle} />
        <View style={{ height: 10 }} />
        <ItemsTable inv={inv} templateDef={templateDef} />
        <View style={{ height: 10 }} />
        <FooterSplit inv={inv} company={company} templateDef={templateDef} />
        <View style={styles.footerFixed} fixed>
          <Text style={styles.footerText}>Generated {today} - Computer generated invoice</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
