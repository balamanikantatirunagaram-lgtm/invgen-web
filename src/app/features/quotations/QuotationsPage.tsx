import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Pencil, Printer, RefreshCw, Trash2, ArrowRight, Share2 } from 'lucide-react';
import { useCompany, useConvertQuotation, useDeleteQuotation, useOwnerId, useQuota, useQuotations, useSetQuotationStatus } from '../../hooks/queries';
import { AppError, userMessage } from '../../lib/errors';
import { FREE_MONTHLY_LIMIT } from '../../api/usage';
import { fmtDate, fmtInr } from '../../lib/format';
import { QUOTATION_STATUSES } from '../../api/types';
import type { Quotation, QuotationFilter } from '../../api/types';
import { printPdf } from '../../pdf/print';
import { Card, ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, PrimaryButton, StatusChip, inputCls } from '../../components/ui';
import { toast } from '../../components/toastBus';

export default function QuotationsPage() {
  const navigate = useNavigate();
  const ownerId = useOwnerId();
  const companyQuery = useCompany();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pending, setPending] = useState<Quotation | null>(null);
  const [busyPdf, setBusyPdf] = useState<string | null>(null);

  const filter: QuotationFilter = {
    query,
    status,
    from: from === '' ? null : new Date(`${from}T00:00:00`),
    to: to === '' ? null : new Date(`${to}T23:59:59.999`),
  };
  const listQuery = useQuotations(filter, 50);
  const quotaQuery = useQuota('quotations');
  const deleteMut = useDeleteQuotation();
  const convertMut = useConvertQuotation();
  const statusMut = useSetQuotationStatus();

  const hasFilter = query.trim() !== '' || status !== '' || from !== '' || to !== '';
  const clearFilters = () => {
    setQuery('');
    setStatus('');
    setFrom('');
    setTo('');
  };

  const needCompany = () => {
    const company = companyQuery.data;
    if (!company) {
      toast('Save your company profile in Settings first to generate PDFs.');
      return null;
    }
    return company;
  };

  const doPrint = async (q: Quotation) => {
    const company = needCompany();
    if (!company || !ownerId) return;
    setBusyPdf(q.quotationId);
    try {
      const { buildInvoicePdf } = await import('../../pdf/buildPdf');
      // Quotations reuse invoice PDF with QUOTATION title
      const fakeInvoice = {
        invoiceId: q.quotationId,
        ownerId: q.ownerId,
        invoiceNumber: q.quotationNumber,
        invoiceDate: q.quotationDate,
        poNumber: '',
        poDate: q.validUntil,
        vehicleNumber: '',
        copyType: `Valid until ${q.validUntil ? fmtDate(q.validUntil) : '-'}`,
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
        status: q.status,
        template: q.template,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
        cancelledAt: null,
      } as never;
      const bytes = await buildInvoicePdf(fakeInvoice as never, company, q.template, { docTitle: 'QUOTATION' });
      await printPdf(bytes, `${q.quotationNumber}.pdf`);
    } catch (e) {
      toast(userMessage(e));
    } finally {
      setBusyPdf(null);
    }
  };

  const doShare = async (q: Quotation) => {
    const company = needCompany();
    if (!company || !ownerId) return;
    setBusyPdf(q.quotationId);
    try {
      const { buildInvoicePdf } = await import('../../pdf/buildPdf');
      const fakeInvoice = {
        invoiceId: q.quotationId,
        ownerId: q.ownerId,
        invoiceNumber: q.quotationNumber,
        invoiceDate: q.quotationDate,
        poNumber: '',
        poDate: q.validUntil,
        vehicleNumber: '',
        copyType: `Valid until ${q.validUntil ? fmtDate(q.validUntil) : '-'}`,
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
        status: q.status,
        template: q.template,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
        cancelledAt: null,
      } as never;
      const bytes = await buildInvoicePdf(fakeInvoice as never, company, q.template, { docTitle: 'QUOTATION' });
      const filename = `${q.quotationNumber.replace(/\//g, '-')}.pdf`;
      const file = new File([bytes.slice()], filename, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
      } else {
        toast('Native sharing is not supported on this device/browser.');
      }
    } catch (e) {
      toast(userMessage(e));
    } finally {
      setBusyPdf(null);
    }
  };

  const doConvert = (q: Quotation) => {
    if (!ownerId) return;
    const prefix = companyQuery.data?.invoicePrefix || 'INV-';
    convertMut.mutate(
      { quotation: q, invoicePrefix: prefix },
      {
        onSuccess: (invoiceId) => {
          toast(`Converted to invoice ${invoiceId.slice(0, 8)}`);
          navigate(`/app/invoices/${invoiceId}`);
        },
        onError: (e) => {
          if (e instanceof AppError && e.kind === 'quota') {
            navigate('/app/limit-reached', { state: { kind: 'invoices' } });
            return;
          }
          toast(userMessage(e));
        },
      },
    );
  };

  const doDelete = () => {
    if (!pending) return;
    deleteMut.mutate(pending.quotationId, {
      onSuccess: () => {
        toast('Quotation deleted');
        setPending(null);
      },
      onError: (e) => toast(userMessage(e)),
    });
  };

  const items = listQuery.data ?? [];
  const actionBusy = deleteMut.isPending || convertMut.isPending || statusMut.isPending;

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Draft → sent → converted funnel"
        action={
          <div className="flex items-center gap-3">
            {quotaQuery.data != null && (
              <span
                className={`text-xs font-bold rounded-full px-3 py-1.5 border ${
                  quotaQuery.data >= FREE_MONTHLY_LIMIT
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-surface-soft text-ink-secondary border-border-color'
                }`}
                title="Free quotations used this month"
              >
                {quotaQuery.data}/{FREE_MONTHLY_LIMIT} free this month
              </span>
            )}
            <PrimaryButton onClick={() => navigate('/app/quotations/new')}>+ New Quotation</PrimaryButton>
          </div>
        }
      />

      <Card className="p-4 mb-4 space-y-3">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter: client / GSTIN / quotation no"
            type="search"
            className={`${inputCls} flex-1`}
          />
          <button onClick={() => listQuery.refetch()} className="shrink-0 px-4 rounded-xl border border-border-strong hover:bg-surface-soft" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          <label className="block">
            <span className="block text-xs font-semibold text-ink-tertiary mb-1">STATUS</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="">All statuses</option>
              {(QUOTATION_STATUSES as readonly string[]).map((s: string) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-ink-tertiary mb-1">FROM</span>
            <input type="date" value={from} max={to === '' ? undefined : to} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-ink-tertiary mb-1">TO</span>
            <input type="date" value={to} min={from === '' ? undefined : from} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </label>
          {hasFilter && (
            <button onClick={clearFilters} className="px-4 py-2.5 rounded-xl border border-border-strong text-sm font-semibold hover:bg-surface-soft">
              Clear
            </button>
          )}
        </div>
      </Card>

      {listQuery.isLoading ? (
        <LoadingState message="Loading quotations…" />
      ) : listQuery.isError ? (
        <ErrorState message={`Quotations unavailable: ${userMessage(listQuery.error)}`} onRetry={() => listQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="No quotations yet" message="Create your first quotation to start the funnel." actionLabel="NEW QUOTATION" onAction={() => navigate('/app/quotations/new')} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-border-color bg-surface-soft/60 text-left">
                  {['Quotation', 'Date', 'Valid Until', 'Grand', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-ink-tertiary">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {items.map((q) => {
                  const converted = q.status === 'converted';
                  const busy = busyPdf === q.quotationId;
                  return (
                    <tr key={q.quotationId} className="hover:bg-surface-soft/40">
                      <td className="px-4 py-3">
                        <Link to={`/app/quotations/${q.quotationId}`} className="font-bold hover:underline">
                          {q.quotationNumber}
                        </Link>
                        <p className="text-ink-secondary truncate max-w-[220px]">{q.billTo.businessName}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(q.quotationDate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{q.validUntil ? fmtDate(q.validUntil) : '-'}</td>
                      <td className="px-4 py-3 font-bold whitespace-nowrap">{fmtInr(q.grandTotal)}</td>
                      <td className="px-4 py-3">
                        <StatusChip status={q.status as never} />
                        {converted && q.convertedInvoiceId && (
                          <Link to={`/app/invoices/${q.convertedInvoiceId}`} className="ml-2 text-xs underline text-ink-secondary">
                            View invoice
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => navigate(`/app/quotations/${q.quotationId}`)} className="p-2 rounded-lg hover:bg-surface-soft" title="View PDF">
                            <Download className="h-4 w-4" />
                          </button>
                          <button onClick={() => doShare(q)} disabled={busy} className="p-2 rounded-lg hover:bg-surface-soft disabled:opacity-50" title="Share">
                            <Share2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => doPrint(q)} disabled={busy} className="p-2 rounded-lg hover:bg-surface-soft disabled:opacity-50" title="Print">
                            <Printer className="h-4 w-4" />
                          </button>
                          {!converted && (
                            <button onClick={() => navigate(`/app/quotations/${q.quotationId}/edit`)} className="p-2 rounded-lg hover:bg-surface-soft" title="Edit">
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {!converted && (
                            <button
                              onClick={() => doConvert(q)}
                              disabled={actionBusy}
                              className="px-2.5 py-1.5 ml-1 rounded-lg text-xs font-bold bg-ink text-surface hover:bg-ink-secondary disabled:opacity-50 flex items-center gap-1"
                            >
                              <ArrowRight className="h-3 w-3" /> Convert
                            </button>
                          )}
                          {q.status === 'draft' && (
                            <button onClick={() => setPending(q)} className="p-2 rounded-lg text-red-700 hover:bg-red-50" title="Delete draft">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pending && (
        <ConfirmDialog
          title="Delete quotation?"
          message={`${pending.quotationNumber} will be permanently removed.`}
          confirmLabel="Delete"
          onConfirm={doDelete}
          onCancel={() => setPending(null)}
          busy={deleteMut.isPending}
          danger
        />
      )}
    </div>
  );
}
