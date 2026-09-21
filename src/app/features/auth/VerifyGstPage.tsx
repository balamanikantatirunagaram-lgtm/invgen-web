import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Loader2 } from 'lucide-react';
import { getSupabase } from '../../supabase/client';
import { useSession } from '../../stores/session';
import { userMessage } from '../../lib/errors';
import { validateGstin } from '../../lib/validators';
import { fetchCompany, saveCompany } from '../../api/companies';
import { fetchProfile, saveProfile } from '../../api/profiles';
import {
  gstDisplayName,
  verifyGst,
  type GstVerificationResult,
} from '../../api/gstVerify';

/**
 * Step 2/2 GST verification — mirrors mobile GstSignupScreen:
 * GSTIN → registry lookup (Edge Function proxy, 24h cache) → result card →
 * consent → writes `profiles` + `companies` → waits for verified row →
 * navigates to /app/dashboard.
 */
export default function VerifyGstPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [gstin, setGstin] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<GstVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      // 1. Profile row with verification evidence.
      await saveProfile(user.uid, {
        email: user.email,
        displayName: user.displayName || gstDisplayName(result),
        gstin: result.gstin,
        legalName: result.legalName,
        tradeName: result.tradeName,
        address: result.address,
        gstVerified: true,
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

      // 3. Refresh guards: invalidate + wait for the verified row to land
      // (navigating early would bounce straight back here).
      const ownerId = user.uid;
      await queryClient.invalidateQueries({ queryKey: ['app', ownerId] });
      const deadline = Date.now() + 15_000;
      let verified = false;
      while (Date.now() < deadline) {
        const p = await fetchProfile(ownerId).catch(() => null);
        if (p?.gstVerified) {
          verified = true;
          useSession.getState().setSession(user, {
            gstVerified: true,
            gstin: p.gstin,
          });
          break;
        }
        await new Promise((r) => setTimeout(r, 750));
      }
      if (!verified) {
        // Continue anyway — realtime/polling will correct the route shortly.
        useSession.getState().setSession(user, { gstVerified: true, gstin: result.gstin });
      }
      navigate('/app/dashboard', { replace: true });
    } catch (e) {
      setError(userMessage(e));
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
              Step 2 of 2
            </span>
          </div>
        )}

        <h1 className="text-3xl font-bold tracking-tight mb-2">Enter your GSTIN</h1>
        <p className="text-ink-secondary mb-6">
          We fetch legal name, trade name and address from the registry to prefill
          your invoices. Lookups are cached for 24 hours.
        </p>

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
        </div>

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
