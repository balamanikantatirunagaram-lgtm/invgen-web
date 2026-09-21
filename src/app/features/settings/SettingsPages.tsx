import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Landmark, ReceiptText } from 'lucide-react';
import {
  useCompany,
  useOwnerId,
  useSaveCompany,
} from '../../hooks/queries';
import { userMessage } from '../../lib/errors';
import {
  requiredField,
  validateEmail,
  validateGstin,
  validateIfsc,
  validateMobile,
} from '../../lib/validators';
import { INDIAN_STATES, normalizeStateCode } from '../../lib/states';
import { pickAndEncodeLogo } from '../../lib/logo';
import { deleteAccountAndData } from '../../api/account';
import {
  INVOICE_TEMPLATES,
  TEMPLATE_META,
  decodeLogo,
  type CompanySettings,
  type InvoiceTemplate,
} from '../../api/types';
import {
  Card,
  ConfirmDialog,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  PrimaryButton,
  inputCls,
} from '../../components/ui';
import { toast } from '../../components/toastBus';
import { getSupabase } from '../../supabase/client';
import { useSession } from '../../stores/session';

// ---------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------

function logoSrc(base64: string): string | null {
  const bytes = decodeLogo(base64);
  if (!bytes) return null;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:image/jpeg;base64,${btoa(bin)}`;
}

function HubRow({
  to,
  icon,
  title,
  summary,
  badge,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  summary: string;
  badge?: string;
}) {
  return (
    <Link to={to}>
      <Card className="p-5 flex items-center gap-4 hover:border-ink transition-colors">
        <div className="h-14 w-14 rounded-2xl bg-surface-soft border border-border-color flex items-center justify-center shrink-0 overflow-hidden">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{title}</p>
          <p className="text-sm text-ink-secondary truncate">{summary}</p>
        </div>
        {badge && (
          <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 rounded-full px-2.5 py-1">
            {badge}
          </span>
        )}
        <ChevronRight className="h-5 w-5 text-ink-tertiary shrink-0" />
      </Card>
    </Link>
  );
}

export default function SettingsHubPage() {
  const companyQuery = useCompany();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccountAndData();
      useSession.getState().signOut();
      navigate('/app/login', { replace: true });
    } catch (e) {
      toast(userMessage(e));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const signOut = async () => {
    await getSupabase().auth.signOut();
    useSession.getState().signOut();
    navigate('/', { replace: true });
  };

  const c = companyQuery.data;
  const hasBusiness = (c?.companyName.trim() ?? '') !== '';
  const hasGst = (c?.gstin.trim() ?? '') !== '';
  const bank = c?.bankDetails;
  const hasBank = (bank?.bankName ?? '') !== '' || (bank?.accountNumber ?? '') !== '';
  const bankLabel = hasBank
    ? `${bank?.bankName === '' ? 'Bank' : bank?.bankName} • ${bank?.accountNumber === '' ? 'no account' : `••••${bank?.accountNumber.slice(-4)}`}`
    : 'Not set';

  return (
    <div>
      <PageHeader title="Settings" subtitle="Company, billing & preferences" />
      {companyQuery.isLoading ? (
        <LoadingState message="Loading company…" />
      ) : companyQuery.isError ? (
        <ErrorState
          message={userMessage(companyQuery.error)}
          onRetry={() => companyQuery.refetch()}
        />
      ) : (
        <div className="space-y-3 max-w-3xl">
          <HubRow
            to="/app/settings/company"
            icon={
              c?.logoBase64 && logoSrc(c.logoBase64) ? (
                <img src={logoSrc(c.logoBase64) as string} alt="" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-6 w-6 text-ink-secondary" />
              )
            }
            title="Company identity"
            summary={hasBusiness ? `${c?.companyName} • ${hasGst ? c?.gstin : 'GSTIN missing'}` : 'Not set — add name & GSTIN'}
            badge={!hasBusiness || !hasGst ? 'Setup' : undefined}
          />
          <HubRow
            to="/app/settings/bank"
            icon={<Landmark className="h-6 w-6 text-ink-secondary" />}
            title="Bank & payout"
            summary={bankLabel}
          />
          <HubRow
            to="/app/settings/invoicing"
            icon={<ReceiptText className="h-6 w-6 text-ink-secondary" />}
            title="Invoice preferences"
            summary={`${c?.invoicePrefix ?? 'INV-'} • ${TEMPLATE_META[c?.invoiceTemplate ?? 'classic'].label}`}
          />

          <Card className="p-5 border-red-200">
            <p className="font-bold text-red-700 mb-1">Danger zone</p>
            <p className="text-sm text-ink-secondary mb-4">
              Permanently delete ALL your data (company, clients, products,
              invoices) and sign out. This cannot be undone. Your login itself
              is removed separately by support.
            </p>
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-5 py-2.5 rounded-xl border border-red-700 text-red-700 text-sm font-semibold hover:bg-red-50 transition-colors"
            >
              Delete my account and data
            </button>
          </Card>

          <Card>
            <button
              onClick={signOut}
              className="w-full p-5 text-left font-semibold hover:bg-surface-soft rounded-2xl transition-colors"
            >
              Sign out
            </button>
          </Card>

          <p className="text-center text-sm text-ink-tertiary pt-2">
            <Link to="/privacy-policy" className="underline">
              Privacy Policy
            </Link>{' '}
            •{' '}
            <Link to="/terms" className="underline">
              Terms of Service
            </Link>
          </p>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete everything?"
          message="Your company profile, clients, products and invoices are permanently erased and you are signed out. Continue?"
          confirmLabel="Delete everything"
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
          busy={deleting}
          danger
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared form shell
// ---------------------------------------------------------------------------

function useCompanyForm() {
  const ownerId = useOwnerId();
  const companyQuery = useCompany();
  const saveMut = useSaveCompany();
  return { ownerId, companyQuery, saveMut };
}

function BackLink() {
  return (
    <Link
      to="/app/settings"
      className="inline-block text-sm font-medium text-ink-secondary hover:text-ink mb-4"
    >
      ← Back to Settings
    </Link>
  );
}

function baseCompany(existing: CompanySettings | null | undefined): Omit<CompanySettings, 'id' | 'updatedAt'> {
  return {
    companyName: existing?.companyName ?? '',
    address: existing?.address ?? '',
    gstin: existing?.gstin ?? '',
    supplyState: existing?.supplyState ?? '',
    mobile: existing?.mobile ?? '',
    email: existing?.email ?? '',
    bankDetails: existing?.bankDetails ?? {
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      branchName: '',
    },
    termsAndConditions: existing?.termsAndConditions ?? [],
    signatoryLabel: existing?.signatoryLabel ?? 'Authorised Signatory',
    logoUrl: existing?.logoUrl ?? '',
    logoBase64: existing?.logoBase64 ?? '',
    invoicePrefix: existing?.invoicePrefix ?? 'INV-',
    invoiceTemplate: existing?.invoiceTemplate ?? 'classic',
  };
}

// ---------------------------------------------------------------------------
// Company identity
// ---------------------------------------------------------------------------

/**
 * Key-remount wrapper: form state initializes from server data once per
 * revision. Polling refetches keep the same key → in-progress edits are
 * never clobbered. No effects or render-time refs needed.
 */
export function CompanySettingsPage() {
  const { data } = useCompany();
  const stamp = data ? String(data.updatedAt ?? 'new') : 'none';
  return <CompanyIdentityForm key={stamp} />;
}

function CompanyIdentityForm() {
  const { ownerId, companyQuery, saveMut } = useCompanyForm();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const c = companyQuery.data;
  const [name, setName] = useState(c?.companyName ?? '');
  const [addr, setAddr] = useState(c?.address ?? '');
  const [gstin, setGstin] = useState(c?.gstin ?? '');
  const [supplyState, setSupplyState] = useState(c?.supplyState ?? '');
  const [mob, setMob] = useState(c?.mobile ?? '');
  const [email, setEmail] = useState(c?.email ?? '');
  const [logo, setLogo] = useState(c?.logoBase64 ?? '');
  const [logoBusy, setLogoBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    setLogoBusy(true);
    try {
      setLogo(await pickAndEncodeLogo(file));
      toast('Logo ready — tap Save to keep it');
    } catch (e) {
      toast(userMessage(e));
    } finally {
      setLogoBusy(false);
    }
  };

  const doSave = () => {
    if (!ownerId) return;
    const e: Record<string, string> = {};
    const n = requiredField(name, 'Company name');
    if (n) e.name = n;
    const a = requiredField(addr, 'Address');
    if (a) e.addr = a;
    const g = validateGstin(gstin, gstin.trim() !== '' || supplyState.trim() === '');
    if (g) e.gstin = g;
    if (gstin.trim() === '' && normalizeStateCode(supplyState) === '') {
      e.supplyState = 'State is required when GSTIN is empty';
    }
    const m = validateMobile(mob);
    if (m) e.mob = m;
    const em = validateEmail(email);
    if (em) e.email = em;
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    saveMut.mutate(
      {
        ...baseCompany(c),
        companyName: name.trim(),
        address: addr.trim(),
        gstin: gstin.trim().toUpperCase(),
        supplyState: supplyState.trim().toUpperCase(),
        mobile: mob.trim(),
        email: email.trim(),
        logoBase64: logo,
      },
      {
        onSuccess: () => {
          toast('Company saved');
          navigate('/app/settings');
        },
        onError: (err) => toast(userMessage(err)),
      },
    );
  };

  return (
    <div className="max-w-3xl">
      <BackLink />
      <PageHeader title="Company identity" subtitle="Logo, name, GSTIN & contact" />
      {companyQuery.isLoading ? (
        <LoadingState message="Loading company…" />
      ) : companyQuery.isError ? (
        <ErrorState message={userMessage(companyQuery.error)} onRetry={() => companyQuery.refetch()} />
      ) : (
        <>
          <Card className="p-5 mb-3 flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-surface-soft border border-border-color flex items-center justify-center overflow-hidden shrink-0">
              {logo && logoSrc(logo) ? (
                <img src={logoSrc(logo) as string} alt="Company logo" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-7 w-7 text-ink-tertiary" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-bold">Company logo</p>
              <p className="text-sm text-ink-secondary">
                Stored in your profile. Prints on invoices.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(ev) => {
                void pickLogo(ev.target.files?.[0]);
                ev.target.value = '';
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={logoBusy}
              className="px-4 py-2 rounded-xl border border-border-strong text-sm font-semibold hover:bg-surface-soft disabled:opacity-60"
            >
              {logoBusy ? '…' : logo === '' ? 'Upload' : 'Replace'}
            </button>
            {logo !== '' && (
              <button
                onClick={() => setLogo('')}
                className="px-3 py-2 text-sm font-semibold text-red-700 hover:underline"
              >
                Remove
              </button>
            )}
          </Card>

          <Card className="p-5 space-y-4">
            <Field label="Company Name" required error={errors.name}>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Address" required error={errors.addr}>
              <textarea value={addr} onChange={(e) => setAddr(e.target.value)} rows={3} className={inputCls} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="GSTIN" required error={errors.gstin}>
                <input
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  maxLength={15}
                  spellCheck={false}
                  className={`${inputCls} uppercase font-mono`}
                />
              </Field>
              <Field
                label="State"
                required={gstin.trim() === ''}
                error={errors.supplyState}
                hint="Place of supply — required when GSTIN is empty"
              >
                <select
                  value={supplyState}
                  onChange={(e) => setSupplyState(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select state…</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Mobile" required error={errors.mob}>
                <input value={mob} onChange={(e) => setMob(e.target.value)} inputMode="tel" className={inputCls} />
              </Field>
              <Field label="Email" required error={errors.email}>
                <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className={inputCls} />
              </Field>
            </div>
          </Card>

          <div className="mt-4">
            <PrimaryButton onClick={doSave} disabled={saveMut.isPending} className="w-full py-3.5">
              {saveMut.isPending ? 'Saving…' : 'Save'}
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bank details
// ---------------------------------------------------------------------------

export function BankSettingsPage() {
  const { data } = useCompany();
  const stamp = data ? String(data.updatedAt ?? 'new') : 'none';
  return <BankDetailsForm key={stamp} />;
}

function BankDetailsForm() {
  const { ownerId, companyQuery, saveMut } = useCompanyForm();
  const navigate = useNavigate();

  const c = companyQuery.data;
  const [bank, setBank] = useState(c?.bankDetails.bankName ?? '');
  const [acc, setAcc] = useState(c?.bankDetails.accountNumber ?? '');
  const [ifsc, setIfsc] = useState(c?.bankDetails.ifscCode ?? '');
  const [branch, setBranch] = useState(c?.bankDetails.branchName ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const doSave = () => {
    if (!ownerId) return;
    const e: Record<string, string> = {};
    const ifscErr = validateIfsc(ifsc, false);
    if (ifscErr) e.ifsc = ifscErr;
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    saveMut.mutate(
      {
        ...baseCompany(c),
        bankDetails: {
          bankName: bank.trim(),
          accountNumber: acc.trim(),
          ifscCode: ifsc.trim().toUpperCase(),
          branchName: branch.trim(),
        },
      },
      {
        onSuccess: () => {
          toast('Bank details saved');
          navigate('/app/settings');
        },
        onError: (err) => toast(userMessage(err)),
      },
    );
  };

  return (
    <div className="max-w-3xl">
      <BackLink />
      <PageHeader title="Bank details" subtitle="Payout account for invoices" />
      {companyQuery.isLoading ? (
        <LoadingState message="Loading company…" />
      ) : companyQuery.isError ? (
        <ErrorState message={userMessage(companyQuery.error)} onRetry={() => companyQuery.refetch()} />
      ) : (
        <>
          <Card className="p-5 space-y-4">
            <Field label="Bank Name">
              <input value={bank} onChange={(e) => setBank(e.target.value)} className={inputCls} placeholder="HDFC Bank" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Account Number">
                <input value={acc} onChange={(e) => setAcc(e.target.value)} inputMode="numeric" className={inputCls} />
              </Field>
              <Field label="IFSC" error={errors.ifsc}>
                <input
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  spellCheck={false}
                  className={`${inputCls} uppercase font-mono`}
                  placeholder="HDFC0001234"
                />
              </Field>
            </div>
            <Field label="Branch">
              <input value={branch} onChange={(e) => setBranch(e.target.value)} className={inputCls} />
            </Field>
          </Card>
          <div className="mt-4">
            <PrimaryButton onClick={doSave} disabled={saveMut.isPending} className="w-full py-3.5">
              {saveMut.isPending ? 'Saving…' : 'Save'}
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invoice preferences
// ---------------------------------------------------------------------------

export function InvoicingSettingsPage() {
  const { data } = useCompany();
  const stamp = data ? String(data.updatedAt ?? 'new') : 'none';
  return <InvoicingPrefsForm key={stamp} />;
}

function InvoicingPrefsForm() {
  const { ownerId, companyQuery, saveMut } = useCompanyForm();
  const navigate = useNavigate();

  const c = companyQuery.data;
  const [prefix, setPrefix] = useState(c?.invoicePrefix ?? 'INV-');
  const [terms, setTerms] = useState(c?.termsAndConditions.join('\n') ?? '');
  const [template, setTemplate] = useState<InvoiceTemplate>(c?.invoiceTemplate ?? 'classic');

  const doSave = () => {
    if (!ownerId) return;
    saveMut.mutate(
      {
        ...baseCompany(c),
        invoicePrefix: prefix.trim() === '' ? 'INV-' : prefix.trim(),
        termsAndConditions: terms
          .split('\n')
          .map((t) => t.trim())
          .filter((t) => t !== ''),
        invoiceTemplate: template,
      },
      {
        onSuccess: () => {
          toast('Preferences saved');
          navigate('/app/settings');
        },
        onError: (err) => toast(userMessage(err)),
      },
    );
  };

  return (
    <div className="max-w-3xl">
      <BackLink />
      <PageHeader title="Invoice preferences" subtitle="Prefix, terms & template" />
      {companyQuery.isLoading ? (
        <LoadingState message="Loading company…" />
      ) : companyQuery.isError ? (
        <ErrorState message={userMessage(companyQuery.error)} onRetry={() => companyQuery.refetch()} />
      ) : (
        <>
          <Card className="p-5 space-y-4">
            <Field label="Invoice Prefix" hint="e.g. INV-25-26-">
              <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Terms & Conditions" hint="One per line">
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={4} className={inputCls} />
            </Field>
            <Field label="Default Invoice Template">
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as InvoiceTemplate)}
                className={inputCls}
              >
                {INVOICE_TEMPLATES.map((t) => (
                  <option key={t} value={t}>
                    {TEMPLATE_META[t].label} — {TEMPLATE_META[t].description}
                  </option>
                ))}
              </select>
            </Field>
          </Card>
          <div className="mt-4">
            <PrimaryButton onClick={doSave} disabled={saveMut.isPending} className="w-full py-3.5">
              {saveMut.isPending ? 'Saving…' : 'Save'}
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}
