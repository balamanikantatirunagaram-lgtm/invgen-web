import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getSupabase, isBackendConfigured } from '../../supabase/client';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/app/dashboard';

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp && !agreed) {
      setError('Please agree to the Terms & Conditions and Privacy Policy to sign up.');
      return;
    }
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    if (!isBackendConfigured) {
      setError('Backend not configured — see .env.example.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (isSignUp) {
        const { error: signUpError } = await getSupabase().auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        // On success, either user is signed in or needs to check email (Supabase config).
        navigate(from, { replace: true });
      } else {
        const { error: signInError } = await getSupabase().auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Try again.');
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    if (isSignUp && !agreed) {
      setError('Please agree to the Terms & Conditions and Privacy Policy.');
      return;
    }
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
    } catch (e: any) {
      setError(e.message || 'Sign-in failed. Try again.');
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
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {isSignUp ? 'Create an account' : 'Welcome back'}
        </h1>
        <p className="text-ink-secondary mb-8">
          {isSignUp 
            ? 'Sign up to create your GST invoicing workspace.' 
            : 'Sign in to access your invoicing workspace.'}
        </p>
        
        {error && (
          <p className="mb-4 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}
        
        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold mb-1.5" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-xl border border-border-strong bg-bg-warm px-4 py-3 outline-none focus:border-ink transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-border-strong bg-bg-warm px-4 py-3 outline-none focus:border-ink transition-colors"
            />
          </div>

          {isSignUp && (
            <div className="pt-2 pb-2 flex items-start">
              <div className="flex h-5 items-center">
                <input
                  id="terms"
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => {
                    setAgreed(e.target.checked);
                    if (e.target.checked) setError(null);
                  }}
                  className="h-4 w-4 rounded border-border-color text-ink focus:ring-ink"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="terms" className="font-medium text-ink-secondary select-none cursor-pointer">
                  By continuing, you agree to our{' '}
                  <Link to="/terms" className="text-blue-600 hover:underline">Terms & Conditions</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
                </label>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || (isSignUp && !agreed)}
            className="w-full py-3.5 rounded-xl bg-ink text-surface font-semibold hover:bg-ink-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Please wait…' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-color"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-surface text-ink-tertiary">Or continue with</span>
          </div>
        </div>

        <button
          onClick={signInWithGoogle}
          disabled={busy || (isSignUp && !agreed)}
          type="button"
          className="w-full py-3.5 rounded-xl border border-border-strong bg-surface text-ink font-semibold hover:bg-bg-warm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mb-6"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google
        </button>

        <p className="text-sm text-ink-tertiary text-center">
          {isSignUp ? (
            <>
              Already have an account?{' '}
              <button onClick={() => setIsSignUp(false)} className="text-ink font-semibold hover:underline">
                Sign in
              </button>
            </>
          ) : (
            <>
              New here?{' '}
              <button onClick={() => setIsSignUp(true)} className="text-ink font-semibold hover:underline">
                Create an account
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
