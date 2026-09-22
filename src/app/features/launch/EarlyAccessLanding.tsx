import { useState } from 'react';
import { getSupabase } from '../../supabase/client';
import { Link } from 'react-router-dom';

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

      if (dbError) {
        if (dbError.code === '23505') throw new Error('You are already on the waitlist!');
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
        <div className="max-w-md space-y-4 bg-surface p-8 rounded-3xl border border-border-color shadow-sm">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
          <h1 className="text-2xl font-bold text-ink">You're on the list!</h1>
          <p className="text-ink-secondary">
            Thank you for your interest. We'll send you an email as soon as we grant you access.
          </p>
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-surface py-3.5 rounded-xl font-bold hover:bg-ink-secondary transition-colors disabled:opacity-50"
          >
            {loading ? 'Joining...' : 'Join the Waitlist'}
          </button>
        </form>

        <div className="text-center pt-4 border-t border-border-color">
          <p className="text-sm text-ink-secondary">
            Already approved?{' '}
            <Link to="/app/login" className="font-bold text-ink hover:underline">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
