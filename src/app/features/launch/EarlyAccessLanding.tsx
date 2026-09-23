import { useState } from 'react';
import { getSupabase } from '../../supabase/client';

export default function EarlyAccessLanding() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const supabase = getSupabase();
      const { error: dbError } = await supabase
        .from('early_access_requests')
        .insert([{ email, name }]);

      // Mark that they have visited/joined the waitlist so middleware lets them to /app/login
      document.cookie = "waitlist=1; path=/; max-age=31536000"; // 1 year expiry

      if (dbError) {
        if (dbError.code === '23505') {
          // Already on waitlist - bypass to login directly
          window.location.href = '/app/login';
          return;
        }
        throw dbError;
      }
      
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to join waitlist.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-warm text-center p-6">
        <div className="max-w-md space-y-6 bg-surface p-8 rounded-3xl border border-border-color shadow-sm">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl">✓</div>
          <h1 className="text-2xl font-bold text-ink">You're on the list!</h1>
          <p className="text-ink-secondary">
            Thank you for joining. Once an admin approves your request, you'll be able to log in and use the app.
          </p>
          <div className="pt-4">
            <button 
              onClick={() => window.location.href = '/app/login'}
              className="w-full bg-surface-soft border border-border-strong text-ink py-3.5 rounded-xl font-bold hover:bg-border-color transition-colors"
            >
              Go to Login Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-warm p-6">
      <div className="max-w-md w-full bg-surface p-8 rounded-3xl border border-border-color shadow-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Early Access</h1>
          <p className="text-ink-secondary">
            Join the waitlist to get exclusive early access to the next generation of invoicing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">Name</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border-strong bg-bg-warm px-4 py-3 outline-none focus:border-ink transition-colors"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Email address</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border-strong bg-bg-warm px-4 py-3 outline-none focus:border-ink transition-colors"
              placeholder="you@example.com"
            />
          </div>

          {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}

          <p className="text-xs text-ink-secondary text-center">
            By joining, you agree to our <a href="/terms" className="underline hover:text-ink">Terms</a> and <a href="/privacy-policy" className="underline hover:text-ink">Privacy Policy</a>.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-surface py-3.5 rounded-xl font-bold hover:bg-ink-secondary transition-colors disabled:opacity-50"
          >
            {loading ? 'Joining...' : 'Join the Waitlist'}
          </button>
        </form>
      </div>
    </div>
  );
}
