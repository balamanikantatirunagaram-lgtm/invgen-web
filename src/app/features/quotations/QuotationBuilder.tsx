import { useTemplates } from '../../hooks/useTemplates';
import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useClients, useCompany, useCreateQuotation, useOwnerId, useQuotation, useUpdateQuotation } from '../../hooks/queries';
import { useSession } from '../../stores/session';
import { userMessage, AppError } from '../../lib/errors';
import { GST_SLABS, UNITS } from '../../lib/constants';
import { fmtInr } from '../../lib/format';
import { validateGstRate } from '../../lib/validators';
import { formatQuotationNumber, type InvoiceTemplate,  } from '../../api/types';
import { peekCounter } from '../../api/counters';
import { buildNewInvoice, effectiveUnit, useBuilder, validateBuilder, type BuilderItem } from '../invoices/builderStore';
import { Card, ConfirmDialog, ErrorState, Field, LoadingState, StatusChip, inputCls } from '../../components/ui';
import { toast } from '../../components/toastBus';

function money(v: number): string {
  return Number.isFinite(v) ? fmtInr(v) : '—';
}

function numInput(v: string, fallback: number): number {
  if (v.trim() === '') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function ClientPicker({ label, value, clients, onPick }: { label: string; value: any; clients: any[]; onPick: (c: any) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  if (value) {
    return (
      <div>
        <p className="text-sm font-semibold mb-1.5">{label}</p>
        <div className="rounded-xl border border-border-strong bg-surface-soft/50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold truncate">{value.businessName}</p>
              <p className="text-xs font-mono text-ink-secondary truncate">{value.gstin === '' ? 'No GSTIN' : value.gstin}</p>
            </div>
            <button onClick={() => onPick(null)} className="text-xs font-bold text-ink-secondary hover:text-ink shrink-0 px-2 py-1">
              Change
            </button>
          </div>
        </div>
      </div>
    );
  }
  const needle = q.trim().toLowerCase();
  const matches = (needle === '' ? clients : clients.filter((c: any) => `${c.businessName} ${c.gstin} ${c.mobile}`.toLowerCase().includes(needle))).slice(0, 8);
  return (
    <div className="relative">
      <Field label={label} required>
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Search name / GSTIN / mobile…" className={inputCls} />
      </Field>
      {open && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-surface border border-border-strong rounded-xl shadow-xl py-1">
          {matches.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-tertiary">
              No matches. <Link to="/app/clients" className="underline font-semibold">Add client →</Link>
            </li>
          ) : (
            matches.map((c: any) => (
              <li key={c.id}>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(c); setOpen(false); setQ(''); }} className="w-full text-left px-4 py-2.5 hover:bg-surface-soft">
                  <p className="font-semibold text-sm truncate">{c.businessName}</p>
                  <p className="text-xs text-ink-tertiary font-mono truncate">{c.gstin === '' ? 'No GSTIN' : c.gstin}</p>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

const cellCls = 'w-full rounded-xl border border-border-strong bg-surface px-2.5 py-2 text-sm outline-none focus:border-ink transition-colors placeholder:text-ink-tertiary';

function ItemRow({ item, index, products, deletable }: { item: BuilderItem; index: number; products: any[]; deletable: boolean }) {
  const updateItem = useBuilder((s) => s.updateItem);
  const removeItem = useBuilder((s) => s.removeItem);
  const selectProduct = useBuilder((s) => s.selectProduct);
  const isInterstate = useBuilder((s) => s.isInterstate);
  const isExempt = useBuilder((s) => s.isExempt);
  const patch = (p: Partial<BuilderItem>) => updateItem(item.key, p);
  return (
    <tr className="border-b border-border-color last:border-0 align-top">
      <td className="px-2 py-2.5 text-sm font-bold text-ink-tertiary w-8">{index + 1}</td>
      <td className="px-2 py-2.5 min-w-[200px]">
        <select value={item.productId} onChange={(e) => { const p = products.find((x: any) => x.id === e.target.value); if (p) selectProduct(item.key, p); else patch({ productId: '' }); }} className={`${cellCls} mb-1.5`} aria-label={`Row ${index + 1} catalog product`}>
          <option value="">Manual entry…</option>
          {products.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input value={item.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Product / service name *" className={cellCls} aria-label={`Row ${index + 1} name`} />
        <input value={item.hsnCode} onChange={(e) => patch({ hsnCode: e.target.value })} placeholder="HSN" inputMode="numeric" className={`${cellCls} mt-1.5 font-mono`} aria-label={`Row ${index + 1} HSN`} />
      </td>
      <td className="px-2 py-2.5 w-[104px]">
        <input value={Number.isFinite(item.quantity) ? String(item.quantity) : ''} onChange={(e) => patch({ quantity: numInput(e.target.value, NaN) })} inputMode="decimal" placeholder="Qty" className={cellCls} aria-label={`Row ${index + 1} quantity`} />
        <select value={item.unit} onChange={(e) => patch({ unit: e.target.value })} className={`${cellCls} mt-1.5`} aria-label={`Row ${index + 1} unit`}>
          {UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
        </select>
        {item.unit === 'Custom' && (<input value={item.customUnit} onChange={(e) => patch({ customUnit: e.target.value })} placeholder="Custom unit" className={`${cellCls} mt-1.5`} aria-label={`Row ${index + 1} custom unit`} />)}
      </td>
      <td className="px-2 py-2.5 w-[112px]">
        <input value={Number.isFinite(item.rate) ? String(item.rate) : ''} onChange={(e) => patch({ rate: numInput(e.target.value, NaN) })} inputMode="decimal" placeholder="0.00" className={cellCls} aria-label={`Row ${index + 1} rate`} />
      </td>
      <td className="px-2 py-2.5 w-[104px]">
        <input value={Number.isFinite(item.gstRate) ? String(item.gstRate) : ''} onChange={(e) => patch({ gstRate: numInput(e.target.value, NaN) })} inputMode="decimal" list={`gst-slabs-${item.key}`} placeholder="GST %" disabled={isExempt} title={isExempt ? 'Bill of Supply — no GST charged' : undefined} className={`${cellCls} disabled:opacity-60`} aria-label={`Row ${index + 1} GST percent`} />
        <datalist id={`gst-slabs-${item.key}`}>{GST_SLABS.map((g) => (<option key={g} value={g} />))}</datalist>
      </td>
      <td className="px-2 py-2.5 text-sm text-right whitespace-nowrap">
        <p className="font-semibold">{money(item.taxableValue)}</p>
        <p className="text-xs text-ink-tertiary">{isInterstate ? `IGST ${item.igstRate}% · ${money(item.igstAmount)}` : `CGST ${item.cgstRate}% · ${money(item.cgstAmount)} + SGST ${item.sgstRate}% · ${money(item.sgstAmount)}`}</p>
        <p className="font-bold mt-0.5">{money(item.itemTotal)}</p>
        <p className="text-xs text-ink-tertiary">{effectiveUnit(item)} · HSN {item.hsnCode === '' ? '—' : item.hsnCode}</p>
      </td>
      <td className="px-2 py-2.5 w-10">
        <button onClick={() => removeItem(item.key)} disabled={!deletable} className="p-2 rounded-lg text-ink-tertiary hover:text-red-700 hover:bg-red-50 disabled:opacity-30" title={deletable ? 'Remove row' : 'Keep at least one row'} aria-label={`Remove row ${index + 1}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

export default function QuotationBuilder() {
  const { data: templates = [] } = useTemplates();
  const { id: editId } = useParams();
  const isEdit = editId != null;
  const navigate = useNavigate();
  const ownerId = useOwnerId();
  const s = useBuilder();
  const clientsQuery = useClients();
  const companyQuery = useCompany();
  const quotationQuery = useQuotation(isEdit ? editId : undefined);
  const createMut = useCreateQuotation();
  const updateMut = useUpdateQuotation();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [editBound, setEditBound] = useState<string | null>(null);
  const [companyBound, setCompanyBound] = useState(false);
  const company = companyQuery.data;
  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);

  const profile = useSession((st) => st.profile);
  const isExempt = profile?.gstExempt === true && !profile?.gstVerified;

  useEffect(() => {
    if (!isEdit) useBuilder.getState().reset();
  }, [editId]);

  useEffect(() => {
    if (!company || companyBound || !ownerId) return;
    const st = useBuilder.getState();
    st.bindCompanyGstin(company.gstin, company.supplyState, isExempt);
    if (!isEdit) {
      st.setTemplate(company.invoiceTemplate);
      const prefix = 'QUO-';
      peekCounter(ownerId).then((seq) => {
        useBuilder.getState().setHeader({ invoiceNumber: formatQuotationNumber(prefix, seq + 1) });
      }).catch(() => {});
    }
    setCompanyBound(true);
  }, [company, companyBound, ownerId, isEdit, isExempt]);

  useEffect(() => {
    if (!isEdit || editBound !== null || !quotationQuery.data || clientsQuery.isLoading) return;
    const q = quotationQuery.data;
    if (!q) return;
    // Map quotation to builder edit state (reuse invoice edit loader)
    const mapped = {
      invoiceNumber: q.quotationNumber,
      invoiceDate: q.quotationDate.toISOString().slice(0, 10),
      poNumber: '',
      poDate: q.validUntil ? q.validUntil.toISOString().slice(0, 10) : '',
      vehicleNumber: '',
      copyType: 'Original for Recipient',
      billTo: q.billTo as any,
      shipTo: q.shipTo as any,
      sameAsBillTo: q.billTo.clientId === q.shipTo.clientId,
      isInterstate: q.isInterstate,
      items: q.items.map((it: any) => ({
        key: '',
        productId: '',
        name: it.name,
        hsnCode: it.hsnCode,
        quantity: it.quantity,
        unit: it.unit,
        customUnit: '',
        rate: it.rate,
        gstRate: it.gstRate,
        taxableValue: it.taxableValue,
        cgstRate: it.cgstRate,
        cgstAmount: it.cgstAmount,
        sgstRate: it.sgstRate,
        sgstAmount: it.sgstAmount,
        igstRate: it.igstRate,
        igstAmount: it.igstAmount,
        itemTotal: it.itemTotal,
      })),
      template: q.template,
      status: q.status,
    } as any;
    // Use loadEditState with quotation-mapped data
    const st = useBuilder.getState();
    // Manually set header and items
    st.setHeader({ invoiceNumber: mapped.invoiceNumber, invoiceDate: mapped.invoiceDate, poDate: mapped.poDate });
    st.setBillTo(mapped.billTo ? { id: mapped.billTo.clientId, businessName: mapped.billTo.businessName, gstin: mapped.billTo.gstin, supplyState: '', billingAddress: mapped.billTo.address, shippingAddress: mapped.billTo.address, mobile: mapped.billTo.mobile, email: mapped.billTo.email, ownerId: ownerId!, tradeName: '' } as any : null);
    if (!mapped.sameAsBillTo) st.setShipTo(mapped.shipTo ? { id: mapped.shipTo.clientId, businessName: mapped.shipTo.businessName, gstin: mapped.shipTo.gstin, supplyState: '', billingAddress: mapped.shipTo.address, shippingAddress: mapped.shipTo.address, mobile: mapped.shipTo.mobile, email: mapped.shipTo.email, ownerId: ownerId!, tradeName: '' } as any : null);
    st.setSameAsBillTo(mapped.sameAsBillTo);
    st.reset();
    // Re-apply after reset (defer to next tick to avoid setState-in-effect)
    setTimeout(() => {
      const cur = useBuilder.getState();
      cur.setHeader({ invoiceNumber: mapped.invoiceNumber, invoiceDate: mapped.invoiceDate, poDate: mapped.poDate });
      cur.setBillTo(mapped.billTo ? { id: mapped.billTo.clientId, businessName: mapped.billTo.businessName, gstin: mapped.billTo.gstin, supplyState: '', billingAddress: mapped.billTo.address, shippingAddress: mapped.billTo.address, mobile: mapped.billTo.mobile, email: mapped.billTo.email, ownerId: ownerId!, tradeName: '' } as any : null);
      cur.setSameAsBillTo(mapped.sameAsBillTo);
      if (!mapped.sameAsBillTo && mapped.shipTo) cur.setShipTo({ id: mapped.shipTo.clientId, businessName: mapped.shipTo.businessName, gstin: mapped.shipTo.gstin, supplyState: '', billingAddress: mapped.shipTo.address, shippingAddress: mapped.shipTo.address, mobile: mapped.shipTo.mobile, email: mapped.shipTo.email, ownerId: ownerId!, tradeName: '' } as any);
      const ids = cur.items.map((i: any) => i.key);
      ids.forEach((k: string) => cur.removeItem(k));
      mapped.items.forEach(() => cur.addItem());
      const newItems = useBuilder.getState().items;
      newItems.forEach((row: any, idx: number) => {
        const src = mapped.items[idx];
        if (src) cur.updateItem(row.key, { name: src.name, hsnCode: src.hsnCode, quantity: src.quantity, unit: src.unit, rate: src.rate, gstRate: src.gstRate });
      });
      cur.setTemplate(mapped.template);
    }, 0);
    setEditBound(q.quotationId);
  }, [isEdit, editBound, quotationQuery.data, clientsQuery.isLoading, company, ownerId, isExempt]);

  const doSave = async (preview: boolean) => {
    if (saving || !ownerId) return;
    setSaveError(null);
    const err = validateBuilder(s, isEdit);
    if (err) { setSaveError(err); return; }
    if (!s.isExempt) {
      for (let i = 0; i < s.items.length; i++) {
        const g = validateGstRate(s.items[i].gstRate);
        if (g) { setSaveError(`Row ${i + 1}: ${g}`); return; }
      }
    }
    setSaving(true);
    try {
      let savedId: string;
      if (!isEdit) {
        const prefix = 'QUO-';
        savedId = await createMut.mutateAsync({
          prefix,
          draftId: useBuilder.getState().draftId,
          build: (number) => {
            const q: any = buildNewInvoice(useBuilder.getState() as any, ownerId, { numberOverride: number });
            // Map invoice fields to quotation
            return {
              ownerId,
              quotationNumber: number,
              quotationDate: q.invoiceDate,
              validUntil: q.poDate,
              billTo: q.billTo,
              shipTo: q.shipTo,
              items: q.items,
              isInterstate: q.isInterstate,
              subTotal: q.subTotal,
              totalTaxableValue: q.totalTaxableValue,
              totalCGST: q.totalCGST,
              totalSGST: q.totalSGST,
              totalIGST: q.totalIGST,
              roundOff: q.roundOff,
              grandTotal: q.grandTotal,
              amountInWords: q.amountInWords,
              status: 'draft',
              convertedInvoiceId: null,
              template: q.template,
            };
          },
        });
        toast('Quotation saved');
      } else {
        const q: any = buildNewInvoice(useBuilder.getState() as any, ownerId, { status: s.editStatus || 'draft' });
        const quotation: any = {
          ownerId,
          quotationNumber: q.invoiceNumber,
          quotationDate: q.invoiceDate,
          validUntil: q.poDate,
          billTo: q.billTo,
          shipTo: q.shipTo,
          items: q.items,
          isInterstate: q.isInterstate,
          subTotal: q.subTotal,
          totalTaxableValue: q.totalTaxableValue,
          totalCGST: q.totalCGST,
          totalSGST: q.totalSGST,
          totalIGST: q.totalIGST,
          roundOff: q.roundOff,
          grandTotal: q.grandTotal,
          amountInWords: q.amountInWords,
          status: s.editStatus || 'draft',
          convertedInvoiceId: null,
          template: q.template,
        };
        await updateMut.mutateAsync({ id: editId as string, quotation });
        savedId = editId as string;
        toast('Quotation saved');
      }
      useBuilder.getState().reset();
      navigate(preview ? `/app/quotations/${savedId}` : '/app/quotations');
    } catch (e) {
      if (e instanceof AppError && e.kind === 'quota') {
        navigate('/app/limit-reached', { state: { kind: 'quotations' } });
        return;
      }
      setSaveError(userMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && quotationQuery.isLoading) return <LoadingState message="Loading quotation…" />;
  if (isEdit && !quotationQuery.isLoading && !quotationQuery.data) return <ErrorState message="Quotation not found." onRetry={() => navigate('/app/quotations')} />;

  const t = s.totals;
  const productsList: any[] = []; // Could fetch products, but keep empty for now

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isEdit ? 'Edit Quotation' : 'New Quotation'}</h1>
          <p className="text-ink-secondary mt-1 flex flex-wrap items-center gap-2">
            {isEdit ? (<><span className="font-mono font-semibold text-ink">{s.invoiceNumber}</span><StatusChip status={s.editStatus || 'draft'} /></>) : (<>Number suggestion: <span className="font-mono font-semibold text-ink">{s.invoiceNumber === '' ? '…' : s.invoiceNumber}</span> · final number assigned on save</>)}
            {s.isExempt && <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5">Bill of Supply</span>}
            <span className="text-xs bg-surface border border-border-color rounded-full px-2.5 py-0.5">GST as estimate</span>
          </p>
        </div>
      </div>
      {saveError && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">{saveError}</div>}
      <div className="grid 2xl:grid-cols-[320px_minmax(0,1fr)_300px] xl:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <h2 className="font-bold">Details</h2>
            <Field label="Quotation Date" required>
              <input type="date" value={s.invoiceDate} onChange={(e) => s.setHeader({ invoiceDate: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Valid Until">
              <input type="date" value={s.poDate} onChange={(e) => s.setHeader({ poDate: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Template">
              <select value={s.template} onChange={(e) => s.setTemplate(e.target.value as InvoiceTemplate)} className={inputCls}>
                {templates.map((t: any) => (<option key={t.id} value={t.id}>{t.name} — {t.base_layout + " layout"}</option>))}
              </select>
            </Field>
          </Card>
          <Card className="p-5 space-y-4">
            <h2 className="font-bold">Customer</h2>
            {clientsQuery.isLoading ? (<p className="text-sm text-ink-tertiary">Loading clients…</p>) : (<>
              <ClientPicker label="Bill To" value={s.billTo} clients={clients} onPick={s.setBillTo} />
              {s.isExempt ? (<div className="rounded-xl bg-amber-50 border border-amber-200 p-3"><p className="text-sm font-semibold text-amber-900">Bill of Supply — no GST</p><p className="text-xs text-amber-800 mt-1">Exempt accounts issue bills without tax.</p></div>) : (<div className="rounded-xl bg-surface-soft/60 border border-border-color p-3"><label className="flex items-center gap-2.5 text-sm cursor-pointer"><input type="checkbox" checked={s.isInterstate} onChange={(e) => s.setInterstate(e.target.checked)} className="h-4 w-4 accent-black" /><span className="font-semibold">Inter-state supply (IGST)</span>{s.interstateAuto && (<span className="text-[11px] font-bold uppercase tracking-wider bg-surface border border-border-strong rounded-full px-2 py-0.5 text-ink-tertiary">Auto</span>)}</label><p className="text-xs text-ink-tertiary mt-1.5">{s.isInterstate ? 'Inter-state → IGST' : 'Intra-state → CGST + SGST'} · auto-detected</p></div>)}
              <label className="flex items-center gap-2.5 text-sm cursor-pointer"><input type="checkbox" checked={s.sameAsBillTo} onChange={(e) => s.setSameAsBillTo(e.target.checked)} className="h-4 w-4 accent-black" /><span className="font-medium">Ship to same as Bill to</span></label>
              {!s.sameAsBillTo && (<ClientPicker label="Ship To" value={s.shipTo} clients={clients} onPick={s.setShipTo} />)}
            </>)}
          </Card>
        </div>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
            <h2 className="font-bold">Items ({s.items.length})</h2>
            <button onClick={() => s.addItem()} className="flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-xl bg-ink text-surface hover:bg-ink-secondary">
              <Plus className="h-4 w-4" /> Add row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead><tr className="border-b border-border-color bg-surface-soft/60 text-left">{['#', 'Product', 'Qty / Unit', 'Rate', 'GST %', 'Tax / Total', ''].map((h) => (<th key={h} className="px-2 py-2.5 text-xs font-bold uppercase tracking-wider text-ink-tertiary">{h}</th>))}</tr></thead>
              <tbody>{s.items.map((it, i) => (<ItemRow key={it.key} item={it} index={i} products={productsList} deletable={s.items.length > 1} />))}</tbody>
            </table>
          </div>
        </Card>
        <div className="xl:col-span-2 2xl:col-span-1">
          <div className="xl:sticky xl:top-24 space-y-4">
            <Card className="p-5">
              <h2 className="font-bold mb-4">Summary (estimate)</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-ink-secondary">Taxable value</dt><dd className="font-semibold">{money(t.totalTaxableValue)}</dd></div>
                {s.isInterstate ? (<div className="flex justify-between"><dt className="text-ink-secondary">IGST</dt><dd className="font-semibold">{money(t.totalIGST)}</dd></div>) : (<><div className="flex justify-between"><dt className="text-ink-secondary">CGST</dt><dd className="font-semibold">{money(t.totalCGST)}</dd></div><div className="flex justify-between"><dt className="text-ink-secondary">SGST</dt><dd className="font-semibold">{money(t.totalSGST)}</dd></div></>)}
                <div className="flex justify-between"><dt className="text-ink-secondary">Round off</dt><dd className="font-semibold">{Number.isFinite(t.roundOff) ? (t.roundOff >= 0 ? '+' : '') + t.roundOff.toFixed(2) : '—'}</dd></div>
                <div className="border-t border-border-color pt-3 flex justify-between items-baseline"><dt className="font-bold">Grand total</dt><dd className="text-2xl font-bold">{money(t.grandTotal)}</dd></div>
              </dl>
              <p className="text-xs text-ink-secondary mt-3 leading-relaxed break-words">{s.amountInWords === '' ? '—' : s.amountInWords}</p>
            </Card>
            <div className="grid grid-cols-2 2xl:grid-cols-1 gap-2">
              <button onClick={() => doSave(false)} disabled={saving} className="py-3.5 rounded-xl bg-ink text-surface font-bold hover:bg-ink-secondary disabled:opacity-60">{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Quotation'}</button>
              <button onClick={() => doSave(true)} disabled={saving} className="py-3.5 rounded-xl border border-border-strong font-bold hover:bg-surface disabled:opacity-60 bg-surface">{saving ? 'Saving…' : 'Save & Preview'}</button>
            </div>
            <Link to="/app/quotations" className="block text-center text-sm font-semibold text-ink-secondary hover:text-ink">← Back to quotations</Link>
          </div>
        </div>
      </div>
      {confirmReset && (<ConfirmDialog title="Reset quotation?" message="Entered customer, items and details will be cleared." confirmLabel="Reset" onConfirm={() => { useBuilder.getState().reset(); setCompanyBound(false); setEditBound(null); setSaveError(null); setConfirmReset(false); }} onCancel={() => setConfirmReset(false)} />)}
    </div>
  );
}
