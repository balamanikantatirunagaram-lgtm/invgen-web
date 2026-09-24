import type { ReactNode } from 'react';

/**
 * Shared desktop SaaS primitives (warm Space Grotesk theme).
 * Deliberately different from the mobile editorial cards.
 */

export const inputCls =
  'w-full rounded-xl border border-border-strong bg-surface px-4 py-2.5 outline-none focus:border-ink transition-colors placeholder:text-ink-tertiary';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-ink-secondary mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-surface border border-border-color rounded-2xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1.5">
        {label} {required && <span className="text-red-700">*</span>}
      </span>
      {children}
      {error && <span className="block mt-1 text-sm text-red-700">{error}</span>}
      {hint && !error && (
        <span className="block mt-1 text-xs text-ink-tertiary">{hint}</span>
      )}
    </label>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${inputCls} max-w-md`}
      type="search"
    />
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="p-12 text-center">
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-ink-secondary mb-6">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 rounded-xl bg-ink text-surface font-semibold hover:bg-ink-secondary transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="p-12 text-center">
      <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
      <p className="text-ink-secondary mb-6">{message}</p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 rounded-xl border border-border-strong font-semibold hover:bg-surface-soft transition-colors"
      >
        Retry
      </button>
    </Card>
  );
}

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <Card className="p-12 text-center">
      <p className="text-ink-secondary font-medium">{message}</p>
    </Card>
  );
}

/** Centered dialog. Overlay click closes (unless busy). */
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto bg-surface border border-border-color rounded-3xl shadow-xl`}
      >
        <div className="sticky top-0 bg-surface border-b border-border-color px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-ink-tertiary hover:text-ink text-2xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="sticky bottom-0 bg-surface border-t border-border-color px-6 py-4 flex justify-end gap-3 rounded-b-3xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  busy,
  danger,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-border-strong font-semibold hover:bg-surface-soft transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-5 py-2.5 rounded-xl font-semibold text-surface transition-colors disabled:opacity-60 ${
              danger ? 'bg-red-700 hover:bg-red-800' : 'bg-ink hover:bg-ink-secondary'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-ink-secondary">{message}</p>
    </Modal>
  );
}

/** Dense desktop data table with horizontal scroll fallback. */
export function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: ReactNode[];
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-border-color bg-surface-soft/60">
              {headers.map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-ink-tertiary ${
                    i === 0 ? 'text-left' : i === headers.length - 1 ? 'text-right' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color">{rows}</tbody>
        </table>
      </div>
    </Card>
  );
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-surface-soft text-ink-secondary border-border-strong',
  issued: 'bg-amber-100 text-amber-800 border-amber-200',
  paid: 'bg-success-bg text-success border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

/** Small status pill shared by dashboard + ledger. */
export function StatusChip({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES['draft'];
  return (
    <span
      className={`inline-block text-[11px] font-bold uppercase tracking-wider border rounded-full px-2.5 py-0.5 ${cls}`}
    >
      {status}
    </span>
  );
}

/** Free-tier monthly usage bar (e.g. "7 of 20 free invoices used"). */
export function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const full = used >= limit;
  return (
    <div
      className={`mb-4 rounded-2xl border px-5 py-4 ${
        full ? 'border-red-200 bg-red-50' : 'border-border-color bg-surface'
      }`}
      title={`Free ${label} used this month — counts drafts + issued (cancelled excluded), resets 1st`}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-bold">
          {used} <span className="text-ink-tertiary font-semibold">of {limit} free {label} used</span>
        </p>
        <p className={`font-semibold ${full ? 'text-red-700' : 'text-ink-secondary'}`}>
          {full ? 'Limit reached' : `${limit - used} left`}
        </p>
      </div>
      <div className="mt-2.5 h-2 rounded-full bg-surface-soft border border-border-color overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${full ? 'bg-red-500' : 'bg-ink'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {full && (
        <p className="mt-2 text-xs text-red-700">
          Monthly free limit reached. Contact admin for an extension — resets on the 1st.
        </p>
      )}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2.5 rounded-xl bg-ink text-surface text-sm font-semibold hover:bg-ink-secondary transition-colors disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}
