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
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { fmtDate } from '../lib/format';
import {
  type CompanySettings,
  type Invoice,
  type InvoiceParty,
  type InvoiceTemplate,
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

function rowStrings(inv: Invoice): string[][] {
  return inv.items.map((it, i) => [
    `${i + 1}`,
    `${it.name}\nHSN: ${it.hsnCode === '' ? '-' : it.hsnCode}`,
    `${qtyStr(it.quantity)}\n${it.unit}`,
    m(it.rate),
    m(it.taxableValue),
    `${Number.isFinite(it.cgstRate) ? it.cgstRate.toFixed(1) : '0.0'}%\n${m(it.cgstAmount)}`,
    `${Number.isFinite(it.sgstRate) ? it.sgstRate.toFixed(1) : '0.0'}%\n${m(it.sgstAmount)}`,
    `${Number.isFinite(it.igstRate) ? it.igstRate.toFixed(1) : '0.0'}%\n${m(it.igstAmount)}`,
    m(it.itemTotal),
  ]);
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function PageHeader({
  inv,
  company,
  template,
  docTitle,
}: {
  inv: Invoice;
  company: CompanySettings;
  template: InvoiceTemplate;
  docTitle: string;
}) {
  const badge = (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{inv.copyType}</Text>
    </View>
  );
  const gstin = <Text style={styles.gstinLine}>GSTIN: {company.gstin === '' ? '-' : company.gstin}</Text>;

  if (template === 'bold') {
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

  if (template === 'modern') {
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
          fontSize: template === 'minimal' ? 13 : 16,
          letterSpacing: template === 'minimal' ? 3 : 0,
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        {docTitle}
      </Text>
      <View style={{ borderBottomWidth: template === 'minimal' ? 0.5 : 1, borderBottomColor: INK, marginTop: 4 }} />
    </View>
  );
}

function IssuerBlock({
  company,
  logoSrc,
  template,
}: {
  company: CompanySettings;
  logoSrc: string | null;
  template: InvoiceTemplate;
}) {
  const isModern = template === 'modern';
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
        <Text style={styles.issuerContact}>
          GSTIN: {company.gstin} - Mobile: {company.mobile} - Email: {company.email}
        </Text>
      </View>
    </View>
  );

  if (template === 'classic') {
    return (
      <View style={{ backgroundColor: SOFT, borderWidth: 0.5, borderColor: MID, padding: 8 }}>
        {row}
      </View>
    );
  }
  return row;
}

function Party({ title, p, template }: { title: string; p: InvoiceParty; template: InvoiceTemplate }) {
  return (
    <View>
      <Text style={styles.partyTitle}>{title}</Text>
      {template === 'modern' && (
        <View style={{ width: 28, height: 2, backgroundColor: INK, marginTop: 2, marginBottom: 3 }} />
      )}
      <Text style={styles.partyName}>{p.businessName}</Text>
      <Text style={styles.partyLine}>{p.address}</Text>
      <Text style={styles.partyLine}>GSTIN: {p.gstin}</Text>
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

function PartiesAndMeta({ inv, template }: { inv: Invoice; template: InvoiceTemplate }) {
  const meta = (
    <View>
      <Kv k="Invoice No" v={inv.invoiceNumber} />
      <Kv k="Invoice Date" v={d(inv.invoiceDate)} />
      <Kv k="PO No" v={inv.poNumber === '' ? '-' : inv.poNumber} />
      <Kv k="PO Date" v={d(inv.poDate)} />
      <Kv k="Vehicle No" v={inv.vehicleNumber === '' ? '-' : inv.vehicleNumber} />
      <Kv k="Supply" v={inv.isInterstate ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'} />
    </View>
  );
  const boxed =
    template === 'minimal' ? (
      meta
    ) : (
      <View
        style={{
          padding: 8,
          borderWidth: template === 'modern' ? 0.8 : 0.5,
          borderColor: template === 'modern' ? INK : MID,
        }}
      >
        {meta}
      </View>
    );

  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ flex: 3 }}>
        <Party title="Bill To" p={inv.billTo} template={template} />
        <View style={{ height: 6 }} />
        <Party title="Ship To" p={inv.shipTo} template={template} />
      </View>
      <View style={{ width: 12 }} />
      <View style={{ flex: 2 }}>{boxed}</View>
    </View>
  );
}

function ItemsTable({ inv, template }: { inv: Invoice; template: InvoiceTemplate }) {
  const headers = ['Sl', 'Description\nHSN', 'Qty\nUnit', 'Rate', 'Taxable', 'CGST\nRt/Amt', 'SGST\nRt/Amt', 'IGST\nRt/Amt', 'Total'];
  const rows = rowStrings(inv);
  const darkHeader = template === 'modern' || template === 'bold';
  const fillHeader = template !== 'minimal';

  const borderColor = template === 'classic' ? GREY600 : INK;
  const borderWidth = template === 'bold' ? 0.8 : 0.5;

  const cellBorder =
    template === 'minimal'
      ? { borderBottomWidth: 0.3, borderBottomColor: SOFT }
      : { borderRightWidth: borderWidth, borderRightColor: borderColor };

  const aligns: ('center' | 'left' | 'right')[] = [
    'center', 'left', 'center', 'right', 'right', 'right', 'right', 'right', 'right',
  ];

  return (
    <View
      style={{
        borderWidth: template === 'minimal' ? 0 : borderWidth,
        borderColor,
        borderTopWidth: template === 'minimal' ? 0.7 : borderWidth,
        borderTopColor: template === 'minimal' ? INK : borderColor,
        borderBottomWidth: template === 'minimal' ? 0.7 : borderWidth,
        borderBottomColor: template === 'minimal' ? INK : borderColor,
      }}
    >
      {/* header */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: !fillHeader ? undefined : darkHeader ? INK : SOFT,
          borderBottomWidth: template === 'minimal' ? 0 : borderWidth,
          borderBottomColor: borderColor,
        }}
      >
        {headers.map((h, i) => (
          <View
            key={h}
            style={{ flex: FLEX[i], padding: 4, alignItems: aligns[i] === 'center' ? 'center' : aligns[i] === 'right' ? 'flex-end' : 'flex-start' }}
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
                flex: FLEX[i],
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

function SectionTitle({ text, template }: { text: string; template: InvoiceTemplate }) {
  return (
    <View style={{ marginBottom: 2 }}>
      <Text style={{ ...styles.sectionTitle, letterSpacing: template === 'minimal' ? 1.5 : 0 }}>
        {text}
      </Text>
      {template === 'modern' && (
        <View style={{ width: 24, height: 1.5, backgroundColor: INK, marginTop: 2, marginBottom: 3 }} />
      )}
    </View>
  );
}

function FooterSplit({
  inv,
  company,
  template,
}: {
  inv: Invoice;
  company: CompanySettings;
  template: InvoiceTemplate;
}) {
  const boldGrand = template === 'bold';
  const rowBorder = template === 'minimal' ? SOFT : GREY400;

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
          borderWidth: template === 'minimal' ? 0 : boldGrand ? 1 : 0.5,
          borderColor: INK,
          borderTopWidth: template === 'minimal' ? 0.8 : boldGrand ? 1 : 0.5,
          borderTopColor: INK,
        }}
      >
        {totalRow('Taxable Value', m(inv.totalTaxableValue), false)}
        {totalRow('CGST', m(inv.totalCGST), false)}
        {totalRow('SGST', m(inv.totalSGST), false)}
        {totalRow('IGST', m(inv.totalIGST), false)}
        {totalRow('Round Off', Number.isFinite(inv.roundOff) ? inv.roundOff.toFixed(2) : '0.00', false)}
        {totalRow(
          'Grand Total',
          `Rs. ${m(inv.grandTotal)}`,
          true,
          boldGrand ? INK : template === 'classic' ? SOFT : undefined,
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

  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ flex: 3 }}>
        <SectionTitle text="Bank Details" template={template} />
        <Text style={styles.small}>
          A/c: {company.bankDetails.accountNumber} - Bank: {company.bankDetails.bankName} - Branch:{' '}
          {company.bankDetails.branchName} - IFSC: {company.bankDetails.ifscCode}
        </Text>
        <View style={{ height: 6 }} />
        <SectionTitle text="Amount in Words" template={template} />
        <Text style={styles.smallBold}>{inv.amountInWords}</Text>
        <View style={{ height: 6 }} />
        <SectionTitle text="Terms & Conditions" template={template} />
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

export function InvoiceDocument({
  inv,
  company,
  template,
  docTitle = 'TAX INVOICE',
}: {
  inv: Invoice;
  company: CompanySettings;
  template: InvoiceTemplate;
  /** Header title — 'TAX INVOICE' normally, 'BILL OF SUPPLY' when exempt. */
  docTitle?: string;
}) {
  const logoSrc = logoDataUrl(company.logoBase64);
  const today = fmtDate(new Date());
  return (
    <Document title={`${docTitle} ${inv.invoiceNumber}`}>
      <Page size="A4" style={styles.page}>
        <PageHeader inv={inv} company={company} template={template} docTitle={docTitle} />
        <View style={{ height: 8 }} />
        <IssuerBlock company={company} logoSrc={logoSrc} template={template} />
        <View style={{ height: 8 }} />
        <PartiesAndMeta inv={inv} template={template} />
        <View style={{ height: 10 }} />
        <ItemsTable inv={inv} template={template} />
        <View style={{ height: 10 }} />
        <FooterSplit inv={inv} company={company} template={template} />
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
