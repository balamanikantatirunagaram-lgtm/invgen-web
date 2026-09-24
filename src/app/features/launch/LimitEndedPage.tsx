import { Link, useLocation } from 'react-router-dom';

/**
 * Shown when a create hits the free monthly quota (20 invoices / 20
 * quotations). Early access has no payment flow — contact admin.
 */
export default function LimitEndedPage() {
  const location = useLocation();
  const kind = (location.state as { kind?: string } | null)?.kind;
  const isQuotation = kind === 'quotations';
  const label = isQuotation ? 'quotations' : 'invoices';
  const back = isQuotation ? '/app/quotations' : '/app/invoices';

  return (
    <div className="max-w-lg mx-auto text-center py-16 space-y-6">
      <div className="text-5xl">🚫</div>
      <h1 className="text-3xl font-bold tracking-tight">Free limit reached</h1>
      <p className="text-ink-secondary leading-relaxed">
        You've used all 20 free <span className="font-semibold text-ink">{label}</span> this month.
        Contact us for an early-access extension — your limit resets on the 1st of every month.
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <a
          href={`/contact?subject=${encodeURIComponent(`Request extension for ${label}`)}&message=${encodeURIComponent(`Hi, I've hit the 20 ${label} free limit this month. Please extend my quota. My account email is listed on my profile.`)}`}
          className="px-6 py-3 rounded-xl bg-ink text-surface font-semibold hover:bg-ink-secondary transition-colors"
        >
          Request extension
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Hi InvGen team, I've hit the 20 ${label} free limit. Please extend my quota.`)}`}
          target="_blank" rel="noreferrer"
          className="px-6 py-3 rounded-xl border border-border-strong font-semibold hover:bg-surface-soft transition-colors"
        >
          WhatsApp us
        </a>
        <Link
          to={back}
          className="px-6 py-3 rounded-xl border border-border-strong font-semibold hover:bg-surface-soft transition-colors"
        >
          Back to {label}
        </Link>
      </div>
    </div>
  );
}
