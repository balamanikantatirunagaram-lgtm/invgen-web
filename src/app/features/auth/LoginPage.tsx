import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getSupabase, isBackendConfigured } from '../../supabase/client';

/** Google sign-in via Supabase OAuth redirect (web flow, mirrors mobile web path). */
export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/app/dashboard';

  const signInWithGoogle = async () => {
    if (!isBackendConfigured) {
      setError('Backend not configured — see .env.example.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: oauthError } = await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/app/dashboard` },
      });
      if (oauthError) throw oauthError;
      // Redirect flow — router picks up the session on return.
      navigate(from, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-warm p-6">
      <div className="w-full max-w-md bg-surface border border-border-color rounded-3xl p-10 shadow-sm">
        <Link to="/" className="flex items-center mb-8">
          <img src="/logo.png" alt="InvGen" className="h-10 w-10 object-contain rounded-lg border border-border-color" />
          <span className="ml-3 text-2xl font-bold tracking-tight">InvGen</span>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h1>
        <p className="text-ink-secondary mb-8">
          Sign in to access your GST invoicing workspace.
        </p>
        {error && (
          <p className="mb-4 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}
        <button
          onClick={signInWithGoogle}
          disabled={busy}
          className="w-full py-3.5 rounded-xl bg-ink text-surface font-semibold hover:bg-ink-secondary transition-colors disabled:opacity-60"
        >
          {busy ? 'Redirecting…' : 'Sign in with Google'}
        </button>
        <p className="mt-6 text-sm text-ink-tertiary text-center">
          New here? Signing in takes you to GST verification next.
        </p>
      </div>
    </div>
  );
}
