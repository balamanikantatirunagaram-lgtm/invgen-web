import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Loader2 } from 'lucide-react';
import { getSupabase } from '../../supabase/client';
import { useSession } from '../../stores/session';
import { userMessage } from '../../lib/errors';
import { normalizeStateCode, INDIAN_STATES } from '../../lib/states';
import { requiredField, validateGstin } from '../../lib/validators';
import { fetchCompany, saveCompany } from '../../api/companies';
import { fetchProfile, saveProfile } from '../../api/profiles';
import {
  gstDisplayName,
  verifyGst,
  type GstVerificationResult,
} from '../../api/gstVerify';

/**
 * Step 2/2 onboarding — mirrors mobile GstSignupScreen + exempt path.
 * Fresh signups pick first: GSTIN verify (tax invoices) or plain-bill
 * mode (no GSTIN — "No GSTIN" card). GSTIN → registry lookup (Edge
 * Function proxy, 24h cache) → result card → consent → writes `profiles`
 * + `companies` → waits for the row → dashboard.
 * Plain-bill mode: display name + state + address → same tables with
 * gst_exempt=true. Also serves exempt→verified upgrades.
 */
export default function VerifyGstPage() {
  const { user, profile } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [gstin, setGstin] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<GstVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Exempt (no-GSTIN) mode.
  const upgrading = profile?.gstExempt === true;
  // Fresh signups choose first: GSTIN path or plain-bill path. Upgrades go straight to GSTIN.
  const [mode, setMode] = useState<'choose' | 'gstin' | 'skip'>(upgrading ? 'gstin' : 'choose');
  const [exName, setExName] = useState('');
  const [exState, setExState] = useState('');
  const [exAddr, setExAddr] = useState('');
  const [exConsent, setExConsent] = useState(false);
  const [exErrors, setExErrors] = useState<Record<string, string>>({});

  const doVerify = async () => {
    const v = validateGstin(gstin);
    setFieldError(v);
    if (v) return;
    setVerifying(true);
    setResult(null);
    setError(null);
    try {
      const r = await verifyGst(gstin, { requireActive: true });
      setResult(r);
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setVerifying(false);
    }
  };

  const doConfirm = async () => {
    if (!result || !user) return;
    setSaving(true);
    setError(null);
    try {
      // 1. Profile row with verification evidence (clears any exempt flag).
      const existingProfileForConfirm = await fetchProfile(user.uid).catch(() => null);
      await saveProfile(user.uid, {
        email: user.email,
        displayName: user.displayName || gstDisplayName(result),
        gstin: result.gstin,
        legalName: result.legalName,
        tradeName: result.tradeName,
        address: result.address,
        gstVerified: true,
        gstExempt: false,
        onboardedAt: existingProfileForConfirm?.onboardedAt ?? null,
        verifiedAt: new Date(),
        verificationStatus: result.status,
      });

      // 2. Company row (preserve existing prefix + prefs).
      const existing = await fetchCompany(user.uid).catch(() => null);
      await saveCompany(user.uid, {
        companyName:
          gstDisplayName(result) !== '' ? gstDisplayName(result) : (existing?.companyName ?? ''),
        address: result.address !== '' ? result.address : (existing?.address ?? ''),
        gstin: result.gstin,
        supplyState: existing?.supplyState ?? '',
        mobile: existing?.mobile ?? '',
        email: existing?.email ?? user.email,
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
      });

      // 3. Refresh guards: invalidate + wait for the row to land
      // (navigating early would bounce straight back here).
      await waitForAccess(user.uid, result.gstin);
      navigate('/app/dashboard', { replace: true });
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setSaving(false);
    }
  };

  /** Wait for the profile row (verified OR exempt) to land, then mirror it. */
  const waitForAccess = async (ownerId: string, fallbackGstin: string | null) => {
    const u = useSession.getState().user;
    await queryClient.invalidateQueries({ queryKey: ['app', ownerId] });
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const p = await fetchProfile(ownerId).catch(() => null);
      if (p?.gstVerified || p?.gstExempt) {
        if (u) {
          useSession.getState().setSession(u, {
            gstVerified: p.gstVerified,
            gstExempt: p.gstExempt,
            gstin: p.gstin,
            onboardedAt: p.onboardedAt,
          });
        }
        return;
      }
      await new Promise((r) => setTimeout(r, 750));
    }
    // Continue anyway — realtime/polling will correct the route shortly.
    if (u) {
      const cur = useSession.getState().profile;
      useSession.getState().setSession(u, {
        gstVerified: cur?.gstVerified ?? false,
        gstExempt: cur?.gstExempt ?? true,
        gstin: fallbackGstin,
        onboardedAt: cur?.onboardedAt ?? null,
      });
    }
  };

  /** Exempt path: no GSTIN → Bill of Supply mode (no registry lookup). */
  const doSkipConfirm = async () => {
    if (!user) return;
    const e: Record<string, string> = {};
    const n = requiredField(exName, 'Business name');
    if (n) e.exName = n;
    if (normalizeStateCode(exState) === '') e.exState = 'Select your state';
    setExErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfile(user.uid, {
        email: user.email,
        displayName: user.displayName || exName.trim(),
        gstin: '',
        legalName: '',
        tradeName: '',
        address: exAddr.trim(),
        gstVerified: false,
        gstExempt: true,
        onboardedAt: null,
        verifiedAt: null,
        verificationStatus: 'exempt',
      });

      const existing = await fetchCompany(user.uid).catch(() => null);
      await saveCompany(user.uid, {
        companyName: exName.trim() !== '' ? exName.trim() : (existing?.companyName ?? ''),
        address: exAddr.trim() !== '' ? exAddr.trim() : (existing?.address ?? ''),
        gstin: '',
        supplyState: normalizeStateCode(exState),
        mobile: existing?.mobile ?? '',
        email: existing?.email ?? user.email,
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
      });

      await waitForAccess(user.uid, null);
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(userMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await getSupabase().auth.signOut();
    useSession.getState().signOut();
    navigate('/app/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg-warm py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center">
            <img
              src="/logo.png"
              alt="InvGen"
              className="h-9 w-9 object-contain rounded-lg border border-border-color"
            />
            <span className="ml-3 text-xl font-bold tracking-tight">InvGen</span>
          </Link>
          <button
            onClick={signOut}
            className="text-sm font-medium text-ink-secondary hover:text-ink"
          >
            Sign out
          </button>
        </div>

        {user && (
          <div className="bg-surface border border-border-color rounded-2xl p-4 mb-6 flex items-center gap-4">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="h-11 w-11 rounded-full" />
            ) : (
              <div className="h-11 w-11 rounded-full bg-surface-soft border border-border-color flex items-center justify-center font-bold text-lg">
                {(user.displayName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">
                {user.displayName === '' ? 'Google user' : user.displayName}
              </p>
              <p className="text-sm text-ink-tertiary truncate">{user.email}</p>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider bg-surface-soft border border-border-color rounded-lg px-3 py-1.5">
              Step 1 of 5
            </span>
          </div>
        )}

        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {upgrading
            ? 'Add your GSTIN'
            : mode === 'choose'
              ? 'How do you want to bill?'
              : mode === 'gstin'
                ? 'Enter your GSTIN'
                : 'Continue without GSTIN'}
        </h1>
        <p className="text-ink-secondary mb-6">
          {upgrading
            ? 'Verify a GSTIN to unlock tax invoices for this workspace.'
            : mode === 'choose'
              ? 'Both paths are free. Pick the one that fits — you can add a GSTIN later, anytime.'
              : mode === 'gstin'
                ? 'We fetch legal name, trade name and address from the registry to prefill your invoices. Lookups are cached for 24 hours.'
                : 'No GSTIN, no problem — issue clean professional bills. Add a GSTIN later to unlock tax invoices.'}
        </p>

        {mode === 'choose' && !upgrading && (
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => {
                setMode('gstin');
                setError(null);
              }}
              className="text-left bg-surface border-2 border-border-color hover:border-ink rounded-3xl p-6 shadow-sm transition-colors"
            >
              <p className="text-lg font-bold mb-1">I have a GSTIN</p>
              <p className="text-sm text-ink-secondary">
                Verify it once and issue GST tax invoices with auto-split CGST / SGST / IGST.
              </p>
            </button>
            <button
              onClick={() => {
                setMode('skip');
                setError(null);
              }}
              className="text-left bg-surface border-2 border-border-color hover:border-ink rounded-3xl p-6 shadow-sm transition-colors"
            >
              <p className="text-lg font-bold mb-1">No GSTIN</p>
              <p className="text-sm text-ink-secondary">
                Continue right now and issue simple bills without GST. Free, same app.
              </p>
            </button>
          </div>
        )}

        {(mode === 'gstin' || upgrading) && (
        <div className="bg-surface border border-border-color rounded-3xl p-6 sm:p-8 shadow-sm">
          <label htmlFor="gstin" className="block text-sm font-semibold mb-2">
            GSTIN *
          </label>
          <input
            id="gstin"
            value={gstin}
            onChange={(e) => {
              setGstin(e.target.value.toUpperCase());
              setResult(null);
              setFieldError(null);
            }}
            maxLength={15}
            placeholder="e.g. 27ABCDE1234F1Z5"
            autoComplete="off"
            spellCheck={false}
            className="w-full uppercase tracking-wider font-mono rounded-xl border border-border-strong bg-bg-warm px-4 py-3 outline-none focus:border-ink transition-colors"
          />
          {fieldError && <p className="mt-2 text-sm text-red-700">{fieldError}</p>}

          <button
            onClick={doVerify}
            disabled={verifying}
            className="mt-4 w-full py-3.5 rounded-xl bg-ink text-surface font-semibold hover:bg-ink-secondary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {verifying && <Loader2 className="h-5 w-5 animate-spin" />}
            {verifying ? 'Verifying…' : 'Verify GST'}
          </button>

          {error && (
            <p className="mt-4 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {!upgrading && (
            <button
              onClick={() => {
                setMode('choose');
                setError(null);
              }}
              className="mt-4 w-full text-sm font-semibold text-ink-secondary hover:text-ink py-1"
            >
              ← Back to options
            </button>
          )}
        </div>
        )}

        {mode === 'skip' && !upgrading && (
          <div className="mt-6 bg-surface border border-border-color rounded-3xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold mb-1">Continue without GSTIN</h2>
            <p className="text-sm text-ink-secondary mb-6">
              You&apos;ll issue <strong>Bills of Supply</strong> (no GST charged).
              Add a GSTIN later to unlock tax invoices.
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="ex-name" className="block text-sm font-semibold mb-1.5">
                  Business name *
                </label>
                <input
                  id="ex-name"
                  value={exName}
                  onChange={(e) => setExName(e.target.value)}
                  placeholder="e.g. Sharma Freelance Services"
                  className="w-full rounded-xl border border-border-strong bg-bg-warm px-4 py-3 outline-none focus:border-ink transition-colors"
                />
                {exErrors.exName && <p className="mt-1 text-sm text-red-700">{exErrors.exName}</p>}
              </div>
              <div>
                <label htmlFor="ex-state" className="block text-sm font-semibold mb-1.5">
                  State / Union Territory (place of supply) *
                </label>
                <select
                  id="ex-state"
                  value={exState}
                  onChange={(e) => setExState(e.target.value)}
                  className="w-full rounded-xl border border-border-strong bg-bg-warm px-4 py-3 outline-none focus:border-ink transition-colors"
                >
                  <option value="">Select State / UT…</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
                {exErrors.exState && <p className="mt-1 text-sm text-red-700">{exErrors.exState}</p>}
              </div>
              <div>
                <label htmlFor="ex-addr" className="block text-sm font-semibold mb-1.5">
                  Business address
                </label>
                <textarea
                  id="ex-addr"
                  value={exAddr}
                  onChange={(e) => setExAddr(e.target.value)}
                  rows={2}
                  placeholder="Shop/office address for your bills"
                  className="w-full rounded-xl border border-border-strong bg-bg-warm px-4 py-3 outline-none focus:border-ink transition-colors"
                />
              </div>
            </div>

            <label className="mt-5 flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={exConsent}
                onChange={(e) => setExConsent(e.target.checked)}
                className="mt-1 h-4 w-4 accent-black"
              />
              <span className="text-ink-secondary">
                I agree to the{' '}
                <Link to="/terms" className="underline text-ink">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy-policy" className="underline text-ink">
                  Privacy Policy
                </Link>
                , and I understand I can only issue Bills of Supply (no GST) until I verify a GSTIN.
              </span>
            </label>

            <button
              onClick={doSkipConfirm}
              disabled={saving || !exConsent}
              className="mt-4 w-full py-3.5 rounded-xl bg-ink text-surface font-semibold hover:bg-ink-secondary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="h-5 w-5 animate-spin" />}
              {saving ? 'Saving…' : 'Continue without GSTIN'}
            </button>
            <button
              onClick={() => setMode('gstin')}
              className="mt-3 w-full text-sm font-semibold text-ink-secondary hover:text-ink"
            >
              I have a GSTIN — verify it instead
            </button>
          </div>
        )}

        {result && (
          <div className="mt-6 bg-surface border border-border-color rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <BadgeCheck className="h-6 w-6 text-success shrink-0 mt-0.5" />
              <h2 className="text-xl font-bold">
                {gstDisplayName(result)} — {result.status}
              </h2>
            </div>
            <dl className="divide-y divide-border-color text-sm">
              {[
                ['GSTIN', result.gstin],
                ['Legal name', result.legalName],
                ['Trade name', result.tradeName],
                ['Constitution', result.constitution],
                ['Registered', result.registrationDate],
                ['Address', result.address],
              ].map(([k, v]) => (
                <div key={k} className="py-2.5 grid grid-cols-[130px_1fr] gap-3">
                  <dt className="text-ink-tertiary">{k}</dt>
                  <dd className="font-semibold">{v === '' ? '–' : v}</dd>
                </div>
              ))}
            </dl>

            <label className="mt-6 flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 accent-black"
              />
              <span className="text-ink-secondary">
                I agree to the{' '}
                <Link to="/terms" className="underline text-ink">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy-policy" className="underline text-ink">
                  Privacy Policy
                </Link>
                , including GSTIN verification and sync of my business data.
              </span>
            </label>

            <button
              onClick={doConfirm}
              disabled={saving || !consent}
              className="mt-4 w-full py-3.5 rounded-xl bg-ink text-surface font-semibold hover:bg-ink-secondary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="h-5 w-5 animate-spin" />}
              {saving ? 'Saving…' : 'Confirm & Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
