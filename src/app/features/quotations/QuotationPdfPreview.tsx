import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Pencil, Printer, Share2 } from 'lucide-react';
import { useCompany, useQuotation } from '../../hooks/queries';
import { userMessage } from '../../lib/errors';
import { fmtDate, fmtInr } from '../../lib/format';
import { INVOICE_TEMPLATES, TEMPLATE_META, type InvoiceTemplate } from '../../api/types';
import { buildInvoicePdf } from '../../pdf/buildPdf';
import { downloadPdf, printPdf } from '../../pdf/print';
import { Card, ErrorState, LoadingState, StatusChip, inputCls } from '../../components/ui';
import { toast } from '../../components/toastBus';

export default function QuotationPdfPreview() {
  const { id } = useParams();
  const quotationQuery = useQuotation(id);
  const companyQuery = useCompany();

  const [template, setTemplate] = useState<InvoiceTemplate | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const q = quotationQuery.data ?? null;
  const company = companyQuery.data ?? null;
  const activeTemplate: InvoiceTemplate = template ?? q?.template ?? company?.invoiceTemplate ?? 'classic';
  const qStamp = q ? `${q.quotationId}:${q.updatedAt ?? ''}` : null;
  const companyStamp = company ? `${company.id}:${company.updatedAt ?? ''}` : null;

  useEffect(() => {
    const liveQ = quotationQuery.data ?? null;
    const liveCompany = companyQuery.data ?? null;
    if (!liveQ || !liveCompany) return;
    let alive = true;
    setBuilding(true);
    setBuildError(null);
    // Map quotation to invoice-like object for PDF reuse
    const fakeInvoice = {
      invoiceId: liveQ.quotationId,
      ownerId: liveQ.ownerId,
      invoiceNumber: liveQ.quotationNumber,
      invoiceDate: liveQ.quotationDate,
      poNumber: '',
      poDate: liveQ.validUntil,
      vehicleNumber: '',
      copyType: liveQ.validUntil ? `Valid until ${fmtDate(liveQ.validUntil)}` : 'Quotation',
      billTo: liveQ.billTo,
      shipTo: liveQ.shipTo,
      items: liveQ.items,
      isInterstate: liveQ.isInterstate,
      subTotal: liveQ.subTotal,
      totalTaxableValue: liveQ.totalTaxableValue,
      totalCGST: liveQ.totalCGST,
      totalSGST: liveQ.totalSGST,
      totalIGST: liveQ.totalIGST,
      roundOff: liveQ.roundOff,
      grandTotal: liveQ.grandTotal,
      amountInWords: liveQ.amountInWords,
      status: liveQ.status,
      template: liveQ.template,
      createdAt: liveQ.createdAt,
      updatedAt: liveQ.updatedAt,
      cancelledAt: null,
    } as never;
    buildInvoicePdf(fakeInvoice as never, liveCompany, activeTemplate, { docTitle: 'QUOTATION' })
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
  }, [qStamp, companyStamp, activeTemplate, retryNonce]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const filename = useMemo(() => `${q?.quotationNumber ?? 'quotation'}.pdf`, [q?.quotationNumber]);

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

  if (quotationQuery.isLoading || companyQuery.isLoading) return <LoadingState message="Preparing quotation…" />;
  if (quotationQuery.isError || !q) return <ErrorState message={quotationQuery.isError ? userMessage(quotationQuery.error) : 'Quotation not found.'} onRetry={() => quotationQuery.refetch()} />;
  if (companyQuery.isError || !company) return <ErrorState message="Save your company profile in Settings first to generate PDFs." onRetry={() => companyQuery.refetch()} />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Link to="/app/quotations" className="text-sm font-medium text-ink-secondary hover:text-ink">
            ← Back to quotations
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-3xl font-bold tracking-tight font-mono">{q.quotationNumber}</h1>
            <StatusChip status={q.status as never} />
          </div>
          <p className="text-ink-secondary mt-1">
            {q.billTo.businessName} • {fmtDate(q.quotationDate)} • {fmtInr(q.grandTotal)} {q.validUntil ? `• Valid until ${fmtDate(q.validUntil)}` : ''}
          </p>
        </div>
        {q.status !== 'converted' && (
          <Link to={`/app/quotations/${q.quotationId}/edit`} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border-strong text-sm font-semibold hover:bg-surface bg-surface">
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        )}
      </div>

      <Card className="p-4 mb-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          Template
          <select value={activeTemplate} onChange={(e) => setTemplate(e.target.value as InvoiceTemplate)} className={`${inputCls} w-auto py-2`}>
            {INVOICE_TEMPLATES.map((t) => (
              <option key={t} value={t}>
                {TEMPLATE_META[t].label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex-1" />
        <button onClick={doShare} disabled={!bytes} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border-strong text-sm font-semibold hover:bg-surface-soft disabled:opacity-50">
          <Share2 className="h-4 w-4" /> Share
        </button>
        <button onClick={doPrint} disabled={!bytes || printing} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border-strong text-sm font-semibold hover:bg-surface-soft disabled:opacity-50">
          <Printer className="h-4 w-4" /> {printing ? 'Printing…' : 'Print'}
        </button>
        <button onClick={doDownload} disabled={!bytes} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-ink text-surface text-sm font-semibold hover:bg-ink-secondary disabled:opacity-50">
          <Download className="h-4 w-4" /> Download
        </button>
      </Card>

      {buildError ? (
        <ErrorState message={buildError} onRetry={() => setRetryNonce((n) => n + 1)} />
      ) : building || !url ? (
        <LoadingState message="Rendering PDF…" />
      ) : (
        <Card className="overflow-hidden">
          <iframe src={url} title={`Quotation ${q.quotationNumber}`} className="w-full h-[80vh] min-h-[480px] bg-surface-soft" />
        </Card>
      )}
    </div>
  );
}
