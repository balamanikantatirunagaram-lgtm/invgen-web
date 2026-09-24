import { useTemplates } from '../../hooks/useTemplates';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import {
  useClients,
  useCompany,
  useCreateInvoice,
  useInvoice,
  useOwnerId,
  useProducts,
  useQuota,
  useUpdateInvoice,
} from '../../hooks/queries';
import { FREE_MONTHLY_LIMIT } from '../../api/usage';
import { useSession } from '../../stores/session';
import { userMessage, AppError } from '../../lib/errors';
import { COPY_TYPES, GST_SLABS, UNITS } from '../../lib/constants';
import { fmtInr, parseDecimal } from '../../lib/format';
import { validateGstRate } from '../../lib/validators';
import { formatInvoiceNumber,  type Client, type InvoiceTemplate } from '../../api/types';
import { peekCounter } from '../../api/counters';
import {
  buildNewInvoice,
  effectiveUnit,
  loadEditState,
  useBuilder,
  validateBuilder,
  type BuilderItem,
} from './builderStore';
import {
  Card,
  ConfirmDialog,
  ErrorState,
  Field,
  LoadingState,
  StatusChip,
  inputCls,
} from '../../components/ui';
import { toast } from '../../components/toastBus';

/** Display helper: transient NaN (cleared inputs) renders as —. */
function money(v: number): string {
  return Number.isFinite(v) ? fmtInr(v) : '—';
}

/** Compact inputs for dense table cells */
const cellCls =
  'w-full rounded-xl border border-border-strong bg-surface px-2.5 py-2 text-sm outline-none focus:border-ink transition-colors placeholder:text-ink-tertiary min-w-[72px]';

// ---------------------------------------------------------------------------
// Searchable client picker
// ---------------------------------------------------------------------------

function ClientPicker({
  label,
  value,
  clients,
  onPick,
}: {
  label: string;
  value: Client | null;
  clients: Client[];
  onPick: (c: Client | null) => void;
}) {
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
              <p className="text-xs font-mono text-ink-secondary truncate">
                {value.gstin === '' ? 'No GSTIN' : value.gstin}
              </p>
              {value.billingAddress !== '' && (
                <p className="text-xs text-ink-secondary line-clamp-2 mt-0.5">{value.billingAddress}</p>
              )}
            </div>
            <button
              onClick={() => {
                onPick(null);
                setQ('');
              }}
              className="text-xs font-bold text-ink-secondary hover:text-ink shrink-0 px-2 py-1"
            >
              Change
            </button>
          </div>
        </div>
      </div>
    );
  }

  const needle = q.trim().toLowerCase();
  const matches = (needle === '' ? clients : clients.filter((c) =>
    `${c.businessName} ${c.gstin} ${c.mobile}`.toLowerCase().includes(needle),
  )).slice(0, 8);

  return (
    <div className="relative">
      <Field label={label} required>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search name / GSTIN / mobile…"
          className={inputCls}
        />
      </Field>
      {open && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-surface border border-border-strong rounded-xl shadow-xl py-1">
          {matches.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-tertiary">
              No matches. <Link to="/app/clients" className="underline font-semibold">Add client →</Link>
            </li>
          ) : (
            matches.map((c) => (
              <li key={c.id}>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(c);
                    setOpen(false);
                    setQ('');
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-surface-soft transition-colors"
                >
                  <p className="font-semibold text-sm truncate">{c.businessName}</p>
                  <p className="text-xs text-ink-tertiary font-mono truncate">
                    {c.gstin === '' ? 'No GSTIN' : c.gstin}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item row (inline editable)
// ---------------------------------------------------------------------------

function toNum(v: string): number {
  const n = parseDecimal(v);
  return Number.isFinite(n) ? n : NaN;
}

function ItemRow({
  item,
  index,
  products,
  deletable,
}: {
  item: BuilderItem;
  index: number;
  products: { id: string; name: string; hsnCode: string; defaultUnit: string; rate: number; gstRate: number }[];
  deletable: boolean;
}) {
  const updateItem = useBuilder((s) => s.updateItem);
  const removeItem = useBuilder((s) => s.removeItem);
  const selectProduct = useBuilder((s) => s.selectProduct);
  const isInterstate = useBuilder((s) => s.isInterstate);
  const isExempt = useBuilder((s) => s.isExempt);

  const patch = (p: Partial<BuilderItem>) => updateItem(item.key, p);

  // Keep raw text while typing; only commit on blur (fixes 10.50→1050 keystroke bug)
  const [qtyRaw, setQtyRaw] = useState(Number.isFinite(item.quantity) ? String(item.quantity) : '');
  const [rateRaw, setRateRaw] = useState(Number.isFinite(item.rate) ? String(item.rate) : '');
  const [gstRaw, setGstRaw] = useState(Number.isFinite(item.gstRate) ? String(item.gstRate) : '');
  useEffect(() => { setQtyRaw(Number.isFinite(item.quantity) ? String(item.quantity) : ''); }, [item.quantity]);
  useEffect(() => { setRateRaw(Number.isFinite(item.rate) ? String(item.rate) : ''); }, [item.rate]);
  useEffect(() => { setGstRaw(Number.isFinite(item.gstRate) ? String(item.gstRate) : ''); }, [item.gstRate]);
  const commitQty = () => patch({ quantity: toNum(qtyRaw) });
  const commitRate = () => patch({ rate: toNum(rateRaw) });
  const commitGst = () => patch({ gstRate: toNum(gstRaw) });

  return (
    <tr className="border-b border-border-color last:border-0 align-top">
      <td className="px-2 py-2.5 text-sm font-bold text-ink-tertiary w-8">{index + 1}</td>
      <td className="px-2 py-2.5 min-w-[200px]">
        <select
          value={item.productId}
          onChange={(e) => {
            const p = products.find((x) => x.id === e.target.value);
            if (p) selectProduct(item.key, p);
            else patch({ productId: '' });
          }}
          className={`${cellCls} mb-1.5`}
          aria-label={`Row ${index + 1} catalog product`}
        >
          <option value="">Manual entry…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          value={item.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Product / service name *"
          className={cellCls}
          aria-label={`Row ${index + 1} name`}
        />
        <input
          value={item.hsnCode}
          onChange={(e) => patch({ hsnCode: e.target.value })}
          placeholder="HSN"
          inputMode="numeric"
          className={`${cellCls} mt-1.5 font-mono`}
          aria-label={`Row ${index + 1} HSN`}
        />
      </td>
      <td className="px-2 py-2.5 w-[104px]">
        <input
          value={qtyRaw}
          onChange={(e) => setQtyRaw(e.target.value)}
          onBlur={commitQty}
          inputMode="decimal"
          placeholder="Qty"
          className={cellCls}
          aria-label={`Row ${index + 1} quantity`}
        />
        <select
          value={item.unit}
          onChange={(e) => patch({ unit: e.target.value })}
          className={`${cellCls} mt-1.5`}
          aria-label={`Row ${index + 1} unit`}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        {item.unit === 'Custom' && (
          <input
            value={item.customUnit}
            onChange={(e) => patch({ customUnit: e.target.value })}
            placeholder="Custom unit"
            className={`${cellCls} mt-1.5`}
            aria-label={`Row ${index + 1} custom unit`}
          />
        )}
      </td>
      <td className="px-2 py-2.5 w-[112px]">
        <input
          value={rateRaw}
          onChange={(e) => setRateRaw(e.target.value)}
          onBlur={commitRate}
          inputMode="decimal"
          placeholder="0.00"
          className={cellCls}
          aria-label={`Row ${index + 1} rate`}
        />
      </td>
      {!isExempt && (
        <td className="px-2 py-2.5 w-[104px]">
          <input
            value={gstRaw}
            onChange={(e) => setGstRaw(e.target.value)}
            onBlur={commitGst}
            inputMode="decimal"
            list={`gst-slabs-${item.key}`}
            placeholder="GST %"
            className={cellCls}
            aria-label={`Row ${index + 1} GST percent`}
          />
          <datalist id={`gst-slabs-${item.key}`}>
            {GST_SLABS.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </td>
      )}
      <td className="px-2 py-2.5 text-sm text-right whitespace-nowrap">
        <p className="font-semibold">{money(item.taxableValue)}</p>
        <p className="text-xs text-ink-tertiary">
          {isInterstate
            ? `IGST ${item.igstRate}% · ${money(item.igstAmount)}`
            : `CGST ${item.cgstRate}% · ${money(item.cgstAmount)} + SGST ${item.sgstRate}% · ${money(item.sgstAmount)}`}
        </p>
        <p className="font-bold mt-0.5">{money(item.itemTotal)}</p>
        <p className="text-xs text-ink-tertiary">{effectiveUnit(item)} · HSN {item.hsnCode === '' ? '—' : item.hsnCode}</p>
      </td>
      <td className="px-2 py-2.5 w-10">
        <button
          onClick={() => removeItem(item.key)}
          disabled={!deletable}
          className="p-2 rounded-lg text-ink-tertiary hover:text-red-700 hover:bg-red-50 disabled:opacity-30"
          title={deletable ? 'Remove row' : 'Keep at least one row'}
          aria-label={`Remove row ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BuilderPage() {
  const { data: templates = [] } = useTemplates();
  const { id: editId } = useParams();
  const isEdit = editId != null;
  const navigate = useNavigate();
  const ownerId = useOwnerId();

  const s = useBuilder();
  const clientsQuery = useClients();
  const companyQuery = useCompany();
  const invoiceQuery = useInvoice(isEdit ? editId : undefined);
  const createMut = useCreateInvoice();
  const updateMut = useUpdateInvoice();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [editBound, setEditBound] = useState<string | null>(null);
  const [companyBound, setCompanyBound] = useState(false);

  const company = companyQuery.data;
  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);
  const products = useProducts().data ?? [];
  const quota = useQuota('invoices').data ?? 0;
  const atLimit = !isEdit && quota >= FREE_MONTHLY_LIMIT;

  // Create mode: fresh form on mount.
  useEffect(() => {
    if (!isEdit) useBuilder.getState().reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // Bind company GSTIN/supply-state (interstate auto-detect) + exempt mode
  // + default template + number suggestion (create mode only).
  const profile = useSession((st) => st.profile);
  const isExempt = profile?.gstExempt === true && !profile?.gstVerified;
  useEffect(() => {
    if (!company || companyBound || !ownerId) return;
    const st = useBuilder.getState();
    st.bindCompanyGstin(company.gstin, company.supplyState, isExempt);
    if (!isEdit) {
      st.setTemplate(company.invoiceTemplate);
      const prefix = company.invoicePrefix === '' ? 'INV-' : company.invoicePrefix;
      peekCounter(ownerId)
        .then((seq) => {
          useBuilder.getState().setHeader({ invoiceNumber: formatInvoiceNumber(prefix, seq + 1) });
        })
        .catch(() => {
          // suggestion is best-effort; atomic save assigns the real number
        });
    }
    setCompanyBound(true);
  }, [company, companyBound, ownerId, isEdit, isExempt]);

  // Edit mode: load invoice + clients once both arrive.
  // Clearing editBound (e.g. via Reset) reloads the saved invoice.
  useEffect(() => {
    if (!isEdit || editBound !== null || !invoiceQuery.data || clientsQuery.isLoading) return;
    const inv = invoiceQuery.data;
    if (!inv) return;
    const st = useBuilder.getState();
    st.loadEdit(loadEditState(inv, clients), company?.gstin ?? '', company?.supplyState ?? '', isExempt);
    st.setTemplate(inv.template ?? company?.invoiceTemplate ?? 'classic');
    setEditBound(inv.invoiceId);
  }, [isEdit, editBound, invoiceQuery.data, clientsQuery.isLoading, clients, company, isExempt]);

  const cancelled = isEdit && s.editStatus === 'cancelled';

  const doSave = async (preview: boolean, draftOverride?: boolean) => {
    if (saving || !ownerId) return;
    if (cancelled) {
      toast('Cancelled invoices cannot be saved.');
      return;
    }
    // Flush any pending raw input (e.g. "10." typed but not blurred)
    if (document.activeElement?.tagName === 'INPUT') (document.activeElement as HTMLElement).blur();
    await new Promise((r) => setTimeout(r, 0));
    const cur = useBuilder.getState();
    setSaveError(null);
    const err = validateBuilder(cur, isEdit);
    if (err) {
      setSaveError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!cur.isExempt) {
      for (let i = 0; i < cur.items.length; i++) {
        const g = validateGstRate(cur.items[i].gstRate);
        if (g) {
          setSaveError(`Row ${i + 1}: ${g}`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      let savedId: string;
      if (!isEdit) {
        const prefix = company?.invoicePrefix || 'INV-';
        const wantDraft = draftOverride === true;
        savedId = await createMut.mutateAsync({
          prefix,
          draftId: cur.draftId,
          build: (number) => buildNewInvoice(cur, ownerId, { numberOverride: number, status: wantDraft ? 'draft' : 'issued' }),
        });
        toast(wantDraft ? 'Draft saved' : 'Invoice issued');
      } else {
        const inv = buildNewInvoice(cur, ownerId, { status: cur.editStatus || 'issued' });
        await updateMut.mutateAsync({ id: editId as string, invoice: inv });
        savedId = editId as string;
        toast('Invoice saved');
      }
      useBuilder.getState().reset();
      navigate(preview ? `/app/invoices/${savedId}` : '/app/invoices');
    } catch (e) {
      if (e instanceof AppError && e.kind === 'quota') {
        setSaveError(userMessage(e));
        return;
      }
      setSaveError(userMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const doIssue = async () => {
    if (!isEdit || !editId || s.editStatus !== 'draft') return;
    setSaving(true);
    try {
      const { setInvoiceStatus } = await import('../../api/invoices');
      await setInvoiceStatus(editId, 'issued');
      toast('Invoice issued');
      navigate(`/app/invoices/${editId}`);
    } catch (e) {
      toast(userMessage(e));
    } finally { setSaving(false); }
  };

  const isDirty =
    s.billTo !== null || s.items.some((i) => i.name.trim() !== '' || i.quantity !== 1 || i.rate !== 0);

  const doReset = () => {
    if (!isEdit && !isDirty) {
      useBuilder.getState().reset();
      setCompanyBound(false);
      return;
    }
    setConfirmReset(true);
  };

  if (isEdit && invoiceQuery.isLoading) {
    return <LoadingState message="Loading invoice…" />;
  }
  if (isEdit && !invoiceQuery.isLoading && !invoiceQuery.data) {
    return (
      <ErrorState
        message="Invoice not found. It may have been deleted."
        onRetry={() => navigate('/app/invoices')}
      />
    );
  }

  const t = s.totals;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEdit ? 'Edit Invoice' : 'New Invoice'}
          </h1>
          <p className="text-ink-secondary mt-1 flex flex-wrap items-center gap-2">
            {isEdit ? (
              <>
                <span className="font-mono font-semibold text-ink">{s.invoiceNumber}</span>
                <StatusChip status={s.editStatus || 'issued'} />
              </>
            ) : (
              <>Number suggestion: <span className="font-mono font-semibold text-ink">{s.invoiceNumber === '' ? '…' : s.invoiceNumber}</span> · final number assigned on save</>
            )}
            {s.isExempt && (
              <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5">
                Bill of Supply
              </span>
            )}
          </p>
        </div>
      </div>

      {cancelled && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">
          This invoice is CANCELLED. Editing and re-saving are disabled.
        </div>
      )}

      {saveError && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">
          {saveError}
        </div>
      )}
      {atLimit && (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900">
          Free limit reached: {quota} of {FREE_MONTHLY_LIMIT} invoices this month. <Link to="/contact" className="underline">Contact admin</Link> for extension — or delete a draft to free a slot. Saving is blocked until next month.
        </div>
      )}

      <div className="grid 2xl:grid-cols-[320px_minmax(0,1fr)_300px] xl:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
        {/* Left: details + parties */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <h2 className="font-bold">Details</h2>
            <Field label="Invoice Date" required>
              <input
                type="date"
                value={s.invoiceDate}
                onChange={(e) => s.setHeader({ invoiceDate: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3">
              <Field label="PO Number">
                <input
                  value={s.poNumber}
                  onChange={(e) => s.setHeader({ poNumber: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="PO Date">
                <input
                  type="date"
                  value={s.poDate}
                  onChange={(e) => s.setHeader({ poDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Vehicle Number">
              <input
                value={s.vehicleNumber}
                onChange={(e) => s.setHeader({ vehicleNumber: e.target.value.toUpperCase() })}
                className={`${inputCls} uppercase font-mono`}
                placeholder="MH01AB1234"
              />
            </Field>
            <Field label="Copy Type">
              <select
                value={s.copyType}
                onChange={(e) => s.setHeader({ copyType: e.target.value })}
                className={inputCls}
              >
                {COPY_TYPES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="PDF Template">
              <select
                value={s.template}
                onChange={(e) => s.setTemplate(e.target.value as InvoiceTemplate)}
                className={inputCls}
              >
                {templates.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.base_layout + " layout"}
                  </option>
                ))}
              </select>
            </Field>
          </Card>


        </div>

        {/* Center: items + parties */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
            <h2 className="font-bold">Items ({s.items.length})</h2>
            <button
              onClick={() => s.addItem()}
              className="flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-xl bg-ink text-surface hover:bg-ink-secondary transition-colors"
            >
              <Plus className="h-4 w-4" /> Add row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] sm:min-w-[620px]">
              <thead>
                <tr className="border-b border-border-color bg-surface-soft/60 text-left">
                  {(s.isExempt ? ['#', 'Product', 'Qty / Unit', 'Rate', 'Total', ''] : ['#', 'Product', 'Qty / Unit', 'Rate', 'GST %', 'Tax / Total', '']).map((h) => (
                    <th key={h} className="px-2 py-2.5 text-xs font-bold uppercase tracking-wider text-ink-tertiary">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.items.map((it, i) => (
                  <ItemRow
                    key={it.key}
                    item={it}
                    index={i}
                    products={products}
                    deletable={s.items.length > 1}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>

          <Card className="p-5 space-y-4">
            <h2 className="font-bold">Customer</h2>
            {clientsQuery.isLoading ? (
              <p className="text-sm text-ink-tertiary">Loading clients…</p>
            ) : (
              <>
                <ClientPicker label="Bill To" value={s.billTo} clients={clients} onPick={s.setBillTo} />
                {s.isExempt ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                    <p className="text-sm font-semibold text-amber-900">Bill of Supply — no GST</p>
                    <p className="text-xs text-amber-800 mt-1">
                      Exempt accounts issue bills without tax. Add a GSTIN to unlock tax invoices.
                    </p>
                  </div>
                ) : (
                <div className="rounded-xl bg-surface-soft/60 border border-border-color p-3">
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={s.isInterstate}
                      onChange={(e) => s.setInterstate(e.target.checked)}
                      className="h-4 w-4 accent-black"
                    />
                    <span className="font-semibold">Inter-state supply (IGST)</span>
                    {s.interstateAuto && (
                      <span className="text-[11px] font-bold uppercase tracking-wider bg-surface border border-border-strong rounded-full px-2 py-0.5 text-ink-tertiary">
                        Auto
                      </span>
                    )}
                  </label>
                  <p className="text-xs text-ink-tertiary mt-1.5">
                    {s.isInterstate ? 'Inter-state → IGST' : 'Intra-state → CGST + SGST'} · auto-detected from
                    GSTINs, toggle to override
                  </p>
                </div>
                )}
                <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.sameAsBillTo}
                    onChange={(e) => s.setSameAsBillTo(e.target.checked)}
                    className="h-4 w-4 accent-black"
                  />
                  <span className="font-medium">Ship to same as Bill to</span>
                </label>
                {!s.sameAsBillTo && (
                  <ClientPicker label="Ship To" value={s.shipTo} clients={clients} onPick={s.setShipTo} />
                )}
              </>
            )}
          </Card>
        </div>

        {/* Right: sticky totals */}
        <div className="xl:col-span-2 2xl:col-span-1">
          <div className="xl:sticky xl:top-24 space-y-4">
            <Card className="p-5">
              <h2 className="font-bold mb-4">Summary</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-secondary">Taxable value</dt>
                  <dd className="font-semibold">{money(t.totalTaxableValue)}</dd>
                </div>
                {s.isInterstate ? (
                  <div className="flex justify-between">
                    <dt className="text-ink-secondary">IGST</dt>
                    <dd className="font-semibold">{money(t.totalIGST)}</dd>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-ink-secondary">CGST</dt>
                      <dd className="font-semibold">{money(t.totalCGST)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-secondary">SGST</dt>
                      <dd className="font-semibold">{money(t.totalSGST)}</dd>
                    </div>
                  </>
                )}
                {Number.isFinite(t.roundOff) && Math.abs(t.roundOff) >= 0.005 && (
                  <div className="flex justify-between">
                    <dt className="text-ink-secondary">Round off</dt>
                    <dd className="font-semibold">{(t.roundOff >= 0 ? '+' : '') + t.roundOff.toFixed(2)}</dd>
                  </div>
                )}
                <div className="border-t border-border-color pt-3 flex justify-between items-baseline">
                  <dt className="font-bold">Grand total</dt>
                  <dd className="text-2xl font-bold">{money(t.grandTotal)}</dd>
                </div>
              </dl>
              <p className="text-xs text-ink-secondary mt-3 leading-relaxed break-words">
                {s.amountInWords === '' ? '—' : s.amountInWords}
              </p>
            </Card>

            {isEdit && s.editStatus === 'draft' && (
              <button onClick={doIssue} disabled={saving} className="w-full py-3.5 rounded-xl bg-success text-white font-bold hover:brightness-95 disabled:opacity-60 mb-2">
                Issue Invoice
              </button>
            )}
            <div className="grid grid-cols-2 2xl:grid-cols-1 gap-2">
              {!isEdit ? (
                <>
                  <button onClick={() => doSave(false, true)} disabled={saving || cancelled || atLimit} className="py-3.5 rounded-xl border border-border-strong font-bold hover:bg-surface disabled:opacity-60 bg-surface">
                    {saving ? 'Saving…' : 'Save as Draft'}
                  </button>
                  <button onClick={() => doSave(false, false)} disabled={saving || cancelled || atLimit} className="py-3.5 rounded-xl bg-ink text-surface font-bold hover:bg-ink-secondary disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save & Issue'}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => doSave(false)} disabled={saving || cancelled} className="py-3.5 rounded-xl bg-ink text-surface font-bold hover:bg-ink-secondary disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button onClick={() => doSave(true)} disabled={saving || cancelled} className="py-3.5 rounded-xl border border-border-strong font-bold hover:bg-surface disabled:opacity-60 bg-surface">
                    {saving ? 'Saving…' : 'Save & Preview PDF'}
                  </button>
                </>
              )}
            </div>
            <button
              onClick={doReset}
              className="w-full text-sm font-semibold text-ink-tertiary hover:text-ink py-1"
            >
              Reset form
            </button>
            <Link to="/app/invoices" className="block text-center text-sm font-semibold text-ink-secondary hover:text-ink">
              ← Back to ledger
            </Link>
          </div>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Reset invoice?"
          message={
            isEdit
              ? 'Unsaved changes will be discarded and the saved invoice reloaded.'
              : 'Entered customer, items and details will be cleared.'
          }
          confirmLabel="Reset"
          onConfirm={() => {
            if (isEdit) {
              // Reload the saved invoice via the load effect.
              setEditBound(null);
            } else {
              useBuilder.getState().reset();
              setCompanyBound(false);
            }
            setSaveError(null);
            setConfirmReset(false);
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
