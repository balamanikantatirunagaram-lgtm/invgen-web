import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Package,
  ReceiptText,
  Users,
} from 'lucide-react';
import { useCompany, useInvoices } from '../../hooks/queries';
import { useSession } from '../../stores/session';
import { userMessage } from '../../lib/errors';
import { fmtDate, fmtInr } from '../../lib/format';
import {
  Card,
  ErrorState,
  LoadingState,
  StatusChip,
} from '../../components/ui';
import {
  computeDashboard,
  greeting,
  isAfterMonth,
  monthKeyOf,
  shiftMonth,
  type MonthKey,
} from './stats';

function monthLabel(m: MonthKey): string {
  return format(new Date(m.year, m.month - 1, 1), 'MMMM yyyy');
}

function SummaryTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-tertiary truncate">
        {label}
      </p>
      <p className="text-2xl font-bold mt-1.5 truncate">{value}</p>
      <p className="text-sm text-ink-secondary mt-0.5 truncate">{sub}</p>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const now = new Date();
  const [month, setMonth] = useState<MonthKey>({ year: now.getFullYear(), month: now.getMonth() + 1 });

  const invoicesQuery = useInvoices({}, 300);
  const companyQuery = useCompany();

  const all = invoicesQuery.data ?? [];
  const stats = computeDashboard(all, month);
  const company = companyQuery.data;
  const businessName =
    company?.companyName !== '' && company?.companyName != null
      ? company.companyName
      : (user?.displayName || user?.email || 'there');
  const pendingCount = all.filter((i) => i.status === 'issued' || i.status === 'draft').length;
  const profileIncomplete =
    !company || company.companyName.trim() === '' || company.gstin.trim() === '';

  const currentMonth = monthKeyOf(new Date());
  const canGoNext = !isAfterMonth(shiftMonth(month, 1), currentMonth);
  const isCurrentMonth = month.year === currentMonth.year && month.month === currentMonth.month;

  if (invoicesQuery.isLoading || companyQuery.isLoading) {
    return <LoadingState message="Loading your business…" />;
  }
  if (invoicesQuery.isError) {
    return (
      <ErrorState
        message={`Stats unavailable: ${userMessage(invoicesQuery.error)}`}
        onRetry={() => invoicesQuery.refetch()}
      />
    );
  }

  return (
    <div>
      {/* Header: greeting + pending bell */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <p className="text-ink-secondary">{greeting(new Date().getHours())},</p>
          <h1 className="text-3xl font-bold tracking-tight truncate">{businessName}</h1>
          <p className="text-sm text-ink-tertiary mt-0.5">Here is your business at a glance.</p>
        </div>
        <button
          onClick={() => navigate('/app/invoices')}
          title={pendingCount > 0 ? `${pendingCount} pending invoices` : 'No pending invoices'}
          className="relative shrink-0 p-3 rounded-2xl bg-surface border border-border-color hover:border-ink transition-colors"
        >
          <Bell className="h-5 w-5" />
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Revenue hero */}
      <div className="bg-ink text-surface rounded-3xl p-6 sm:p-8 shadow-xl mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-70">Total revenue</p>
            <p className="text-sm opacity-70">{isCurrentMonth ? 'Current month' : monthLabel(month)}</p>
          </div>
          <div className="flex items-center gap-1 bg-surface/10 rounded-full px-1.5 py-1">
            <button
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="p-1.5 rounded-full hover:bg-surface/15"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold px-1 min-w-[110px] text-center">
              {monthLabel(month)}
            </span>
            <button
              onClick={() => canGoNext && setMonth((m) => shiftMonth(m, 1))}
              disabled={!canGoNext}
              className="p-1.5 rounded-full hover:bg-surface/15 disabled:opacity-30"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <p className="text-4xl sm:text-5xl font-bold tracking-tight">{fmtInr(stats.revenue)}</p>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="text-xs font-semibold bg-surface/15 rounded-full px-3 py-1.5">
            {stats.inMonth.length} invoice{stats.inMonth.length === 1 ? '' : 's'}
          </span>
          {stats.deltaPct !== null ? (
            <span className="text-xs font-semibold bg-surface/15 rounded-full px-3 py-1.5">
              {stats.deltaPct >= 0 ? '+' : ''}
              {stats.deltaPct.toFixed(1)}% vs prev. month
            </span>
          ) : (
            <span className="text-xs opacity-60">No prior-month data</span>
          )}
        </div>

        {(stats.taxMonth.cgst + stats.taxMonth.sgst + stats.taxMonth.igst) > 0 && (
          <p className="text-sm opacity-70 mt-3">
            Tax collected — CGST {fmtInr(stats.taxMonth.cgst)} · SGST {fmtInr(stats.taxMonth.sgst)} · IGST{' '}
            {fmtInr(stats.taxMonth.igst)}
          </p>
        )}

        <Link
          to="/app/invoices/new"
          className="mt-6 flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-surface text-ink font-bold hover:bg-surface-soft transition-colors"
        >
          <FilePlus2 className="h-5 w-5" /> Create Invoice
        </Link>
      </div>

      {/* Summary grid */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Summary</h2>
        <Link to="/app/invoices" className="text-sm font-semibold text-ink-secondary hover:text-ink">
          Ledger →
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <SummaryTile
          label="Total invoices"
          value={String(stats.visible.length)}
          sub={`${stats.cancelledCount} cancelled`}
        />
        <SummaryTile
          label="Outstanding"
          value={fmtInr(stats.outstanding)}
          sub={`${stats.unpaidCount} unpaid`}
        />
        <SummaryTile
          label="Paid"
          value={fmtInr(stats.paid)}
          sub={`${stats.paidCount} invoices`}
        />
        <SummaryTile
          label="Open / overdue"
          value={String(stats.overdueCount)}
          sub="issued awaiting payment"
        />
      </div>

      {/* Recent + quick actions */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-2">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <h2 className="text-lg font-bold">Recent invoices</h2>
            <Link to="/app/invoices" className="text-sm font-semibold text-ink-secondary hover:text-ink">
              View All
            </Link>
          </div>
          {stats.recent.length === 0 ? (
            <p className="px-4 pb-5 pt-1 text-ink-secondary text-sm">
              No invoices yet. Create your first invoice to see it here.
            </p>
          ) : (
            <ul className="divide-y divide-border-color">
              {stats.recent.map((inv) => (
                <li key={inv.invoiceId}>
                  <button
                    onClick={() => navigate(`/app/invoices/${inv.invoiceId}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-soft/60 text-left transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{inv.invoiceNumber}</p>
                      <p className="text-sm text-ink-secondary truncate">
                        {inv.billTo.businessName} • {fmtDate(inv.invoiceDate)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold">{fmtInr(inv.grandTotal)}</p>
                      <StatusChip status={inv.status} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-lg font-bold mb-4">Quick actions</h2>
            <div className="grid grid-cols-4 lg:grid-cols-2 gap-2">
              {[
                { to: '/app/invoices/new', label: 'Create Invoice', icon: FilePlus2 },
                { to: '/app/clients', label: 'Add Client', icon: Users },
                { to: '/app/products', label: 'Add Product', icon: Package },
                { to: '/app/invoices', label: 'View Ledger', icon: ReceiptText },
              ].map(({ to, label, icon: Icon }) => (
                <Link
                  key={to + label}
                  to={to}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-border-color hover:border-ink hover:bg-surface-soft/60 transition-colors text-center"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[11px] font-semibold leading-tight">{label}</span>
                </Link>
              ))}
            </div>
          </Card>

          {profileIncomplete && (
            <Card className="p-5 bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <Building2 className="h-6 w-6 text-amber-700 shrink-0" />
                <div className="flex-1">
                  <p className="font-bold">Finish company setup</p>
                  <p className="text-sm text-ink-secondary">
                    Add company name + GSTIN so invoices and PDFs are complete.
                  </p>
                </div>
                <Link
                  to="/app/settings"
                  className="text-sm font-bold text-amber-800 hover:underline shrink-0"
                >
                  Setup
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
