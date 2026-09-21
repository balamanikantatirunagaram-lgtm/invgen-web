import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Building2, Users, Package, FilePlus2, ArrowRight } from 'lucide-react';
import { useCompany, useCreateClient, useCreateProduct, useOwnerId } from '../../hooks/queries';
import { useSession } from '../../stores/session';
import { fetchProfile, saveProfile } from '../../api/profiles';
import { saveCompany } from '../../api/companies';
import { userMessage } from '../../lib/errors';
import { requiredField, validateGstin, validateMobile } from '../../lib/validators';
import { normalizeStateCode, INDIAN_STATES } from '../../lib/states';
import { TEMPLATE_META, INVOICE_TEMPLATES, type InvoiceTemplate } from '../../api/types';
import { inputCls } from '../../components/ui';
import { toast } from '../../components/toastBus';
import { GST_SLABS, UNITS } from '../../lib/constants';

/**
 * 4-step welcome wizard — Phase B.
 * Reuses existing client/product/company forms in a linear flow.
 * Skip sets onboardedAt without requiring data.
 */
export default function WelcomeWizard() {
  const { user, profile } = useSession();
  const ownerId = useOwnerId();
  const companyQuery = useCompany();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Step 1: Confirm profile
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [gstin, setGstin] = useState('');
  const [mobile, setMobile] = useState('');

  // Step 2: Business type + defaults
  const company = companyQuery.data;
  const [prefix, setPrefix] = useState(company?.invoicePrefix ?? 'INV-');
  const [template, setTemplate] = useState<InvoiceTemplate>(company?.invoiceTemplate ?? 'classic');
  const [supplyState, setSupplyState] = useState(company?.supplyState ?? '');

  // Step 3: First client/product
  const createClient = useCreateClient();
  const createProduct = useCreateProduct();
  const [clientName, setClientName] = useState('');
  const [clientGstin, setClientGstin] = useState('');
  const [clientState, setClientState] = useState('');
  const [productName, setProductName] = useState('');
  const [productRate, setProductRate] = useState('');
  const [productGst, setProductGst] = useState('18');
  const [productUnit, setProductUnit] = useState('Nos');

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isExempt = profile?.gstExempt === true && !profile?.gstVerified;

  const markOnboarded = async (skip = false) => {
    if (!ownerId || !user) return;
    setSaving(true);
    try {
      const p = await fetchProfile(ownerId);
      if (p) {
        await saveProfile(ownerId, { ...p, onboardedAt: new Date() });
        // Mirror to session
        useSession.getState().setSession(user, {
          gstVerified: p.gstVerified,
          gstExempt: p.gstExempt,
          gstin: p.gstin,
          onboardedAt: new Date(),
        });
      }
      toast(skip ? 'Welcome skipped — you can finish setup from Settings' : 'Welcome complete! 🎉');
      navigate('/app/dashboard', { replace: true });
    } catch (e) {
      toast(userMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleStep1Next = () => {
    const e: Record<string, string> = {};
    const n = requiredField(displayName, 'Display name');
    if (n) e.displayName = n;
    // GSTIN optional at this step — validation only if provided
    if (gstin.trim() !== '') {
      const g = validateGstin(gstin, true);
      if (g) e.gstin = g;
    }
    if (mobile.trim() !== '') {
      const m = validateMobile(mobile, false);
      if (m) e.mobile = m;
    }
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setStep(2);
  };

  const handleStep2Next = async () => {
    if (!ownerId) return;
    setSaving(true);
    try {
      const existing = company;
      // Save prefix/template/supplyState to company
      const base = {
        companyName: existing?.companyName ?? displayName,
        address: existing?.address ?? '',
        gstin: existing?.gstin ?? gstin.trim().toUpperCase(),
        supplyState: isExempt ? normalizeStateCode(supplyState) : (existing?.supplyState ?? ''),
        mobile: existing?.mobile ?? mobile.trim(),
        email: existing?.email ?? user?.email ?? '',
        bankDetails: existing?.bankDetails ?? { bankName: '', accountNumber: '', ifscCode: '', branchName: '' },
        termsAndConditions: existing?.termsAndConditions ?? [],
        signatoryLabel: existing?.signatoryLabel ?? 'Authorised Signatory',
        logoUrl: existing?.logoUrl ?? '',
        logoBase64: existing?.logoBase64 ?? '',
        invoicePrefix: prefix.trim() === '' ? 'INV-' : prefix.trim(),
        invoiceTemplate: template,
      };
      await saveCompany(ownerId, base);
      await companyQuery.refetch();
      setStep(3);
    } catch (e) {
      toast(userMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleStep3Next = async () => {
    // Create client/product if filled, but allow skipping
    const hasClient = clientName.trim() !== '';
    const hasProduct = productName.trim() !== '';
    
    if (hasClient) {
      const e: Record<string, string> = {};
      const n = requiredField(clientName, 'Client name');
      if (n) e.clientName = n;
      if (clientGstin.trim() !== '') {
        const g = validateGstin(clientGstin, false);
        if (g) e.clientGstin = g;
      }
      if (clientGstin.trim() === '' && normalizeStateCode(clientState) === '') {
        e.clientState = 'State required when GSTIN empty';
      }
      if (Object.keys(e).length > 0) {
        setErrors(e);
        return;
      }
      try {
        await createClient.mutateAsync({
          businessName: clientName.trim(),
          tradeName: '',
          gstin: clientGstin.trim().toUpperCase(),
          supplyState: normalizeStateCode(clientState),
          billingAddress: '',
          shippingAddress: '',
          mobile: '',
          email: '',
        });
        toast('First client added');
      } catch (e) {
        toast(userMessage(e));
        return;
      }
    }

    if (hasProduct) {
      const rate = Number(productRate);
      if (!Number.isFinite(rate) || rate < 0) {
        setErrors({ productRate: 'Rate must be >= 0' });
        return;
      }
      try {
        await createProduct.mutateAsync({
          name: productName.trim(),
          hsnCode: '',
          defaultUnit: productUnit,
          rate,
          gstRate: Number(productGst),
        });
        toast('First product added');
      } catch (e) {
        toast(userMessage(e));
        return;
      }
    }

    setStep(4);
  };

  const progress = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-bg-warm flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-border-color">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="InvGen" className="h-8 w-8 object-contain rounded-lg border border-border-color" />
            <span className="ml-3 text-xl font-bold tracking-tight">InvGen</span>
          </Link>
          <button
            onClick={() => markOnboarded(true)}
            disabled={saving}
            className="text-sm font-medium text-ink-secondary hover:text-ink disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
        <div className="h-1 bg-surface-soft">
          <div className="h-full bg-ink transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  s < step
                    ? 'bg-ink text-surface border-ink'
                    : s === step
                      ? 'bg-surface text-ink border-ink'
                      : 'bg-surface text-ink-tertiary border-border-strong'
                }`}
              >
                {s < step ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < totalSteps && (
                <div className={`flex-1 h-0.5 ${s < step ? 'bg-ink' : 'bg-border-color'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Confirm profile */}
        {step === 1 && (
          <div className="bg-surface border border-border-color rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-2xl bg-surface-soft border border-border-color flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Confirm your profile</h1>
                <p className="text-sm text-ink-secondary">Step 1 of 4 — let's get your workspace ready</p>
              </div>
            </div>

            {user && (
              <div className="bg-surface-soft border border-border-color rounded-2xl p-4 mb-6 flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-ink text-surface flex items-center justify-center font-bold">
                    {(user.displayName || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold">{user.displayName || 'Google user'}</p>
                  <p className="text-sm text-ink-tertiary">{user.email}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Display name *</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} placeholder="Your business name" />
                {errors.displayName && <p className="mt-1 text-sm text-red-700">{errors.displayName}</p>}
              </div>
              {!isExempt && (
                <div>
                  <label className="block text-sm font-semibold mb-1.5">GSTIN (optional now)</label>
                  <input
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    maxLength={15}
                    placeholder="27ABCDE1234F1Z5"
                    className={`${inputCls} uppercase font-mono`}
                  />
                  {errors.gstin && <p className="mt-1 text-sm text-red-700">{errors.gstin}</p>}
                  <p className="mt-1 text-xs text-ink-tertiary">Add later from Settings if you don't have it now</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold mb-1.5">Mobile (optional)</label>
                <input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" className={inputCls} placeholder="9876543210" />
                {errors.mobile && <p className="mt-1 text-sm text-red-700">{errors.mobile}</p>}
              </div>
            </div>

            <button
              onClick={handleStep1Next}
              className="mt-6 w-full py-3.5 rounded-xl bg-ink text-surface font-semibold hover:bg-ink-secondary transition-colors flex items-center justify-center gap-2"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>
            {isExempt && (
              <p className="mt-3 text-center text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
                Bill of Supply mode — no GST charged
              </p>
            )}
          </div>
        )}

        {/* Step 2: Business defaults */}
        {step === 2 && (
          <div className="bg-surface border border-border-color rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-2xl bg-surface-soft border border-border-color flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Business defaults</h2>
                <p className="text-sm text-ink-secondary">Step 2 of 4 — prefix and template</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Invoice prefix</label>
                <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className={inputCls} placeholder="INV-" />
                <p className="mt-1 text-xs text-ink-tertiary">e.g. INV-25-26- → INV-25-26-0001</p>
              </div>
              {isExempt && (
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Place of supply (state)</label>
                  <select value={supplyState} onChange={(e) => setSupplyState(e.target.value)} className={inputCls}>
                    <option value="">Select state…</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold mb-1.5">Default template</label>
                <div className="grid grid-cols-2 gap-3">
                  {INVOICE_TEMPLATES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTemplate(t)}
                      className={`p-4 rounded-2xl border-2 text-left transition-colors ${
                        template === t ? 'border-ink bg-surface-soft' : 'border-border-color hover:border-border-strong'
                      }`}
                    >
                      <p className="font-bold text-sm">{TEMPLATE_META[t].label}</p>
                      <p className="text-xs text-ink-secondary mt-0.5">{TEMPLATE_META[t].description}</p>
                      {template === t && <Check className="h-4 w-4 mt-2 text-ink" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="flex-1 py-3.5 rounded-xl border border-border-strong font-semibold hover:bg-surface-soft transition-colors">
                Back
              </button>
              <button
                onClick={handleStep2Next}
                disabled={saving}
                className="flex-1 py-3.5 rounded-xl bg-ink text-surface font-semibold hover:bg-ink-secondary transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: First client/product */}
        {step === 3 && (
          <div className="bg-surface border border-border-color rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-2xl bg-surface-soft border border-border-color flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">First client & product</h2>
                <p className="text-sm text-ink-secondary">Step 3 of 4 — add them now or skip</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="border border-border-color rounded-2xl p-4">
                <h3 className="font-bold flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4" /> First client (optional)
                </h3>
                <div className="space-y-3">
                  <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputCls} placeholder="Acme Traders" />
                  {errors.clientName && <p className="text-sm text-red-700 -mt-2">{errors.clientName}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={clientGstin}
                      onChange={(e) => setClientGstin(e.target.value.toUpperCase())}
                      maxLength={15}
                      placeholder="GSTIN (optional)"
                      className={`${inputCls} uppercase font-mono text-sm`}
                    />
                    <select value={clientState} onChange={(e) => setClientState(e.target.value)} className={`${inputCls} text-sm`}>
                      <option value="">State</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.clientGstin && <p className="text-sm text-red-700 -mt-2">{errors.clientGstin}</p>}
                  {errors.clientState && <p className="text-sm text-red-700 -mt-2">{errors.clientState}</p>}
                </div>
              </div>

              <div className="border border-border-color rounded-2xl p-4">
                <h3 className="font-bold flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4" /> First product (optional)
                </h3>
                <div className="space-y-3">
                  <input value={productName} onChange={(e) => setProductName(e.target.value)} className={inputCls} placeholder="Steel Bolt" />
                  <div className="grid grid-cols-3 gap-2">
                    <input value={productRate} onChange={(e) => setProductRate(e.target.value)} inputMode="decimal" className={inputCls} placeholder="Rate" />
                    <select value={productGst} onChange={(e) => setProductGst(e.target.value)} className={inputCls}>
                      {GST_SLABS.map((g) => (
                        <option key={g} value={String(g)}>
                          {g}% GST
                        </option>
                      ))}
                    </select>
                    <select value={productUnit} onChange={(e) => setProductUnit(e.target.value)} className={inputCls}>
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.productRate && <p className="text-sm text-red-700 -mt-2">{errors.productRate}</p>}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(2)} className="flex-1 py-3.5 rounded-xl border border-border-strong font-semibold hover:bg-surface-soft transition-colors">
                Back
              </button>
              <button
                onClick={handleStep3Next}
                disabled={createClient.isPending || createProduct.isPending}
                className="flex-1 py-3.5 rounded-xl bg-ink text-surface font-semibold hover:bg-ink-secondary transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createClient.isPending || createProduct.isPending ? 'Saving…' : 'Continue'} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button onClick={() => setStep(4)} className="mt-3 w-full text-sm font-medium text-ink-secondary hover:text-ink">
              Skip — add later
            </button>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="bg-surface border border-border-color rounded-3xl p-6 sm:p-8 shadow-sm text-center">
            <div className="h-16 w-16 rounded-full bg-success-bg border border-green-200 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">You're all set! 🎉</h2>
            <p className="text-ink-secondary mb-6">Your workspace is ready. Create your first invoice in under a minute.</p>

            <div className="grid grid-cols-3 gap-3 mb-6 text-left">
              <div className="bg-surface-soft border border-border-color rounded-2xl p-3 text-center">
                <Users className="h-5 w-5 mx-auto mb-1" />
                <p className="text-xs font-bold">Clients</p>
                <p className="text-xs text-ink-tertiary">Ready</p>
              </div>
              <div className="bg-surface-soft border border-border-color rounded-2xl p-3 text-center">
                <Package className="h-5 w-5 mx-auto mb-1" />
                <p className="text-xs font-bold">Products</p>
                <p className="text-xs text-ink-tertiary">Ready</p>
              </div>
              <div className="bg-surface-soft border border-border-color rounded-2xl p-3 text-center">
                <FilePlus2 className="h-5 w-5 mx-auto mb-1" />
                <p className="text-xs font-bold">Invoices</p>
                <p className="text-xs text-ink-tertiary">Ready</p>
              </div>
            </div>

            <button
              onClick={() => markOnboarded(false)}
              disabled={saving}
              className="w-full py-3.5 rounded-xl bg-ink text-surface font-semibold hover:bg-ink-secondary transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? 'Saving…' : 'Create your first invoice'} <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => markOnboarded(false)}
              disabled={saving}
              className="mt-3 w-full py-3 rounded-xl border border-border-strong font-semibold hover:bg-surface-soft transition-colors"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
