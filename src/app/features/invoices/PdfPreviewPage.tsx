import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Pencil, Printer, Share2 } from 'lucide-react';
import { useCompany, useInvoice } from '../../hooks/queries';
import { userMessage } from '../../lib/errors';
import { fmtDate, fmtInr } from '../../lib/format';
import {
  INVOICE_TEMPLATES,
  TEMPLATE_META,
  type InvoiceTemplate,
} from '../../api/types';
import { buildInvoicePdf } from '../../pdf/buildPdf';
import { docTitleFor } from '../../pdf/logoUtil';
import { downloadPdf, printPdf } from '../../pdf/print';
import {
  Card,
  ErrorState,
  LoadingState,
  StatusChip,
  inputCls,
} from '../../components/ui';
import { toast } from '../../components/toastBus';

/**
 * Invoice PDF preview — mirrors mobile InvoicePdfViewerScreen:
 * fetches the invoice, builds via the PDF service + company + logo,
 * shows an embedded preview with download / print / share actions.
 * Template picker defaults to the company default (per-invoice choice).
 */
export default function PdfPreviewPage() {
  const { id } = useParams();
  const invoiceQuery = useInvoice(id);
  const companyQuery = useCompany();

  const [template, setTemplate] = useState<InvoiceTemplate | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const inv = invoiceQuery.data ?? null;
  const company = companyQuery.data ?? null;
  // Per-invoice template wins (persisted at save); company default is fallback.
  const activeTemplate: InvoiceTemplate = template ?? inv?.template ?? company?.invoiceTemplate ?? 'classic';
  // Stable stamps: polling refetches return new object identities — rebuild
  // the PDF only when content actually changes.
  const invStamp = inv ? `${inv.invoiceId}:${inv.updatedAt ?? ''}` : null;
  const companyStamp = company ? `${company.id}:${company.updatedAt ?? ''}` : null;

  useEffect(() => {
    const liveInv = invoiceQuery.data ?? null;
    const liveCompany = companyQuery.data ?? null;
    if (!liveInv || !liveCompany) return;
    let alive = true;
    setBuilding(true);
    setBuildError(null);
    buildInvoicePdf(liveInv, liveCompany, activeTemplate, {
      docTitle: docTitleFor(liveCompany),
    })
      .then((b) => {
        if (!alive) return;
        const blob = new Blob([b.slice()], { type: 'application/pdf' });
        const objectUrl = URL.createObjectURL(blob);
        setUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
        setBytes(b);
      })
      .catch((e) => {
        if (alive) setBuildError(userMessage(e));
      })
      .finally(() => {
        if (alive) setBuilding(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invStamp, companyStamp, activeTemplate, retryNonce]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const filename = useMemo(
    () => `${inv?.invoiceNumber ?? 'invoice'}.pdf`,
    [inv?.invoiceNumber],
  );

  const doDownload = () => {
    if (bytes) {
      downloadPdf(bytes, filename);
      toast('PDF downloaded');
    }
  };

  const doPrint = async () => {
    if (!bytes || printing) return;
    setPrinting(true);
    try {
      await printPdf(bytes, filename);
    } catch (e) {
      toast(userMessage(e));
    } finally {
      setPrinting(false);
    }
  };

  const doShare = async () => {
    if (!bytes) return;
    try {
      const file = new File([bytes.slice()], filename, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
      } else {
        doDownload();
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      toast(userMessage(e));
    }
  };

  if (invoiceQuery.isLoading || companyQuery.isLoading) {
    return <LoadingState message="Preparing invoice…" />;
  }
  if (invoiceQuery.isError || !inv) {
    return (
      <ErrorState
        message={invoiceQuery.isError ? userMessage(invoiceQuery.error) : 'Invoice not found.'}
        onRetry={() => invoiceQuery.refetch()}
      />
    );
  }
  if (companyQuery.isError || !company) {
    return (
      <ErrorState
        message="Save your company profile in Settings first to generate PDFs."
        onRetry={() => companyQuery.refetch()}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Link to="/app/invoices" className="text-sm font-medium text-ink-secondary hover:text-ink">
            ← Back to ledger
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-3xl font-bold tracking-tight font-mono">{inv.invoiceNumber}</h1>
            <StatusChip status={inv.status} />
          </div>
          <p className="text-ink-secondary mt-1">
            {inv.billTo.businessName} • {fmtDate(inv.invoiceDate)} • {fmtInr(inv.grandTotal)}
          </p>
        </div>
        {inv.status !== 'cancelled' && (
          <Link
            to={`/app/invoices/${inv.invoiceId}/edit`}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border-strong text-sm font-semibold hover:bg-surface transition-colors bg-surface"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        )}
      </div>

      <Card className="p-4 mb-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          Template
          <select
            value={activeTemplate}
            onChange={(e) => setTemplate(e.target.value as InvoiceTemplate)}
            className={`${inputCls} w-auto py-2`}
          >
            {INVOICE_TEMPLATES.map((t) => (
              <option key={t} value={t}>
                {TEMPLATE_META[t].label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex-1" />
        <button
          onClick={doShare}
          disabled={!bytes}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border-strong text-sm font-semibold hover:bg-surface-soft disabled:opacity-50 transition-colors"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
        <button
          onClick={doPrint}
          disabled={!bytes || printing}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border-strong text-sm font-semibold hover:bg-surface-soft disabled:opacity-50 transition-colors"
        >
          <Printer className="h-4 w-4" /> {printing ? 'Printing…' : 'Print'}
        </button>
        <button
          onClick={doDownload}
          disabled={!bytes}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-ink text-surface text-sm font-semibold hover:bg-ink-secondary disabled:opacity-50 transition-colors"
        >
          <Download className="h-4 w-4" /> Download
        </button>
      </Card>

      {buildError ? (
        <ErrorState message={buildError} onRetry={() => setRetryNonce((n) => n + 1)} />
      ) : building || !url ? (
        <LoadingState message="Rendering PDF…" />
      ) : (
        <Card className="overflow-hidden">
          <iframe
            src={url}
            title={`Invoice ${inv.invoiceNumber}`}
            className="w-full h-[80vh] min-h-[480px] bg-surface-soft"
          />
        </Card>
      )}
    </div>
  );
}
