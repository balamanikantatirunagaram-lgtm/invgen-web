import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Copy,
  Download,
  Pencil,
  Printer,
  RefreshCw,
  Share2,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  useCancelInvoice,
  useCompany,
  useDeleteInvoice,
  useDuplicateInvoice,
  useInvoices,
  useOwnerId,
  useQuota,
  useSetInvoiceStatus,
} from '../../hooks/queries';
import { AppError, userMessage } from '../../lib/errors';
import { FREE_MONTHLY_LIMIT } from '../../api/usage';
import { fmtDate, fmtInr, fmtQty } from '../../lib/format';
import { INVOICE_STATUSES, type InvoiceStatus } from '../../lib/constants';
import type { Invoice, InvoiceFilter } from '../../api/types';
// NOTE: buildPdf (@react-pdf/renderer) is dynamic-imported in doPrint so the
// heavy renderer stays out of the main bundle (see lazy PdfPreviewPage route).
import { docTitleFor } from '../../pdf/logoUtil';
import { printPdf } from '../../pdf/print';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  StatusChip,
  UsageBar,
  inputCls,
} from '../../components/ui';
import { toast } from '../../components/toastBus';

type PendingAction =
  | { kind: 'delete'; inv: Invoice }
  | { kind: 'cancel'; inv: Invoice }
  | null;

export default function LedgerPage() {
  const navigate = useNavigate();
  const ownerId = useOwnerId();
  const companyQuery = useCompany();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pending, setPending] = useState<PendingAction>(null);
  const [busyPdf, setBusyPdf] = useState<string | null>(null);

  const filter: InvoiceFilter = {
    query,
    status,
    from: from === '' ? null : new Date(`${from}T00:00:00`),
    // End-of-day so the `to` date is inclusive (mirrors mobile 23:59).
    to: to === '' ? null : new Date(`${to}T23:59:59.999`),
  };
  const listQuery = useInvoices(filter, 50);
  const quotaQuery = useQuota('invoices');
  const deleteMut = useDeleteInvoice();
  const cancelMut = useCancelInvoice();
  const paidMut = useSetInvoiceStatus();
  const duplicateMut = useDuplicateInvoice();

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

  const doPrint = async (inv: Invoice) => {
    const company = needCompany();
    if (!company || !ownerId) return;
    setBusyPdf(inv.invoiceId);
    try {
      const { buildInvoicePdf } = await import('../../pdf/buildPdf');
      const bytes = await buildInvoicePdf(inv, company, inv.template ?? company.invoiceTemplate, {
        docTitle: docTitleFor(company),
      });
      await printPdf(bytes, `${inv.invoiceNumber}.pdf`);
    } catch (e) {
      toast(userMessage(e));
    } finally {
      setBusyPdf(null);
    }
  };

  const doShare = async (inv: Invoice) => {
    const company = needCompany();
    if (!company || !ownerId) return;
    setBusyPdf(inv.invoiceId);
    try {
      const { buildInvoicePdf } = await import('../../pdf/buildPdf');
      const bytes = await buildInvoicePdf(inv, company, inv.template ?? company.invoiceTemplate, {
        docTitle: docTitleFor(company),
      });
      const filename = `${inv.invoiceNumber.replace(/\//g, '-')}.pdf`;
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

  const doMarkPaid = (inv: Invoice) => {
    paidMut.mutate(
      { id: inv.invoiceId, status: 'paid' },
      {
        onSuccess: () => toast(`${inv.invoiceNumber} marked paid`),
        onError: (e) => toast(userMessage(e)),
      },
    );
  };

  const doDuplicate = (inv: Invoice) => {
    if (!ownerId) return;
    const prefix = companyQuery.data?.invoicePrefix || 'INV-';
    duplicateMut.mutate(
      { prefix, source: inv },
      {
        onSuccess: () => toast(`Duplicated as draft`),
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

  const doConfirmPending = () => {
    if (!pending) return;
    if (pending.kind === 'delete') {
      deleteMut.mutate(pending.inv.invoiceId, {
        onSuccess: () => {
          toast('Draft deleted');
          setPending(null);
        },
        onError: (e) => toast(userMessage(e)),
      });
    } else {
      cancelMut.mutate(pending.inv.invoiceId, {
        onSuccess: () => {
          toast(`${pending.inv.invoiceNumber} cancelled`);
          setPending(null);
        },
        onError: (e) => toast(userMessage(e)),
      });
    }
  };

  const items = listQuery.data ?? [];
  const actionBusy =
    deleteMut.isPending || cancelMut.isPending || paidMut.isPending || duplicateMut.isPending;

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Ledger • search, filter, act"
        action={
          <PrimaryButton onClick={() => navigate('/app/invoices/new')}>
            + New Invoice
          </PrimaryButton>
        }
      />

      {quotaQuery.data != null && (
        <UsageBar used={quotaQuery.data} limit={FREE_MONTHLY_LIMIT} label="invoices" />
      )}

      <Card className="p-4 mb-4 space-y-3">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter: client / GSTIN / invoice no"
            type="search"
            className={`${inputCls} flex-1`}
          />
          <button
            onClick={() => listQuery.refetch()}
            className="shrink-0 px-4 rounded-xl border border-border-strong hover:bg-surface-soft transition-colors"
            title="Refresh"
            aria-label="Refresh ledger"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          <label className="block">
            <span className="block text-xs font-semibold text-ink-tertiary mb-1">STATUS</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="">All statuses</option>
              {(INVOICE_STATUSES as readonly string[]).map((s: string) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-ink-tertiary mb-1">FROM</span>
            <input
              type="date"
              value={from}
              max={to === '' ? undefined : to}
              onChange={(e) => setFrom(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-ink-tertiary mb-1">TO</span>
            <input
              type="date"
              value={to}
              min={from === '' ? undefined : from}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
            />
          </label>
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 rounded-xl border border-border-strong text-sm font-semibold hover:bg-surface-soft transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </Card>

      {listQuery.isLoading ? (
        <LoadingState message="Loading ledger…" />
      ) : listQuery.isError ? (
        <ErrorState
          message={`Ledger unavailable: ${userMessage(listQuery.error)}`}
          onRetry={() => listQuery.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No invoices match"
          message="Try clearing filters, or create your first invoice."
          actionLabel="NEW INVOICE"
          onAction={() => navigate('/app/invoices/new')}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-border-color bg-surface-soft/60 text-left">
                  {['Invoice', 'Date', 'Taxable / Grand', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-ink-tertiary"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {items.map((inv) => {
                  const cancelled = inv.status === 'cancelled';
                  const busy = busyPdf === inv.invoiceId;
                  return (
                    <tr key={inv.invoiceId} className="hover:bg-surface-soft/40">
                      <td className="px-4 py-3">
                        <Link
                          to={`/app/invoices/${inv.invoiceId}`}
                          className="font-bold hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                        <p className="text-ink-secondary truncate max-w-[220px]">
                          {inv.billTo.businessName}
                        </p>
                        <p className="text-xs text-ink-tertiary">{inv.copyType}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(inv.invoiceDate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-ink-secondary">{fmtInr(inv.totalTaxableValue)}</span>
                        {'  •  '}
                        <span className="font-bold">{fmtInr(inv.grandTotal)}</span>
                        <span className="text-xs text-ink-tertiary"> ({fmtQty(inv.items.length)} items)</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={inv.status as InvoiceStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => navigate(`/app/invoices/${inv.invoiceId}`)}
                            className="p-2 rounded-lg hover:bg-surface-soft"
                            title="View PDF"
                            aria-label={`View ${inv.invoiceNumber} PDF`}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => doShare(inv)}
                            disabled={busy}
                            className="p-2 rounded-lg hover:bg-surface-soft disabled:opacity-50"
                            title="Share"
                            aria-label={`Share ${inv.invoiceNumber}`}
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => doPrint(inv)}
                            disabled={busy}
                            className="p-2 rounded-lg hover:bg-surface-soft disabled:opacity-50"
                            title="Print"
                            aria-label={`Print ${inv.invoiceNumber}`}
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          {!cancelled && (
                            <button
                              onClick={() => navigate(`/app/invoices/${inv.invoiceId}/edit`)}
                              className="p-2 rounded-lg hover:bg-surface-soft"
                              title="Edit"
                              aria-label={`Edit ${inv.invoiceNumber}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => doDuplicate(inv)}
                            disabled={actionBusy}
                            className="p-2 rounded-lg hover:bg-surface-soft disabled:opacity-50"
                            title="Duplicate as draft"
                            aria-label={`Duplicate ${inv.invoiceNumber}`}
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          {inv.status === 'issued' && (
                            <button
                              onClick={() => doMarkPaid(inv)}
                              disabled={actionBusy}
                              className="px-2.5 py-1.5 ml-1 rounded-lg text-xs font-bold text-success bg-success-bg hover:brightness-95 disabled:opacity-50"
                            >
                              Paid
                            </button>
                          )}
                          {inv.status === 'draft' ? (
                            <button
                              onClick={() => setPending({ kind: 'delete', inv })}
                              className="p-2 rounded-lg text-red-700 hover:bg-red-50"
                              title="Delete draft"
                              aria-label={`Delete draft ${inv.invoiceNumber}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : (
                            !cancelled && (
                              <button
                                onClick={() => setPending({ kind: 'cancel', inv })}
                                className="p-2 rounded-lg text-red-700 hover:bg-red-50"
                                title="Cancel invoice"
                                aria-label={`Cancel ${inv.invoiceNumber}`}
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            )
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

      {pending?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete draft?"
          message={`${pending.inv.invoiceNumber} • ${fmtInr(pending.inv.grandTotal)}. Drafts are permanently deleted. Issued invoices can only be cancelled.`}
          confirmLabel="Delete"
          onConfirm={doConfirmPending}
          onCancel={() => setPending(null)}
          busy={deleteMut.isPending}
          danger
        />
      )}
      {pending?.kind === 'cancel' && (
        <ConfirmDialog
          title="Cancel invoice?"
          message={`${pending.inv.invoiceNumber} • ${fmtInr(pending.inv.grandTotal)}. The sequential record is kept for GST audit, but it can no longer be edited or deleted.`}
          confirmLabel="Cancel invoice"
          onConfirm={doConfirmPending}
          onCancel={() => setPending(null)}
          busy={cancelMut.isPending}
          danger
        />
      )}
    </div>
  );
}
