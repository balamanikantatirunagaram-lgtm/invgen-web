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
        Your limit resets on the 1st of every month. Need more? Reach us via Help &amp; Support —
        an admin can grant a per-account extension.
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <Link
          to="/app/settings/support"
          className="px-6 py-3 rounded-xl bg-ink text-surface font-semibold hover:bg-ink-secondary transition-colors"
        >
          Contact support
        </Link>
        {/* No phone numbers anywhere — contact via contact.invgen@gmail.com / Help & Support only */}
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
