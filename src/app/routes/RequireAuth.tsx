import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getSupabase, isBackendConfigured } from '../supabase/client';
import { useSession } from '../stores/session';

/**
 * Guards /app/* routes. Mirrors mobile app_router.dart:
 * signed-out users bounce to /app/login (public landing stays open).
 */
export default function RequireAuth() {
  const { user, loading, setSession, setLoading } = useSession();
  const location = useLocation();

  useEffect(() => {
    if (!isBackendConfigured) {
      setLoading(false);
      return;
    }
    let alive = true;
    const supabase = getSupabase();

    const mapSession = async () => {
      const { data } = await supabase.auth.getSession();
      const s = data.session;
      if (!alive) return;
      if (!s?.user) {
        setSession(null, null);
        return;
      }
      const meta = (s.user.user_metadata ?? {}) as Record<string, string>;
      const { data: row } = await supabase
        .from('profiles')
        .select('gst_verified, gstin')
        .eq('id', s.user.id)
        .maybeSingle();
      setSession(
        {
          uid: s.user.id,
          email: s.user.email ?? '',
          displayName: meta.full_name ?? meta.name ?? s.user.email ?? '',
          photoURL: meta.avatar_url ?? meta.picture ?? null,
        },
        row
          ? { gstVerified: Boolean(row.gst_verified), gstin: row.gstin ?? null }
          : null,
      );
    };

    void mapSession();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void mapSession();
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [setSession, setLoading]);

  if (!isBackendConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-warm p-6">
        <div className="max-w-md text-center bg-surface border border-border-color rounded-3xl p-10">
          <h1 className="text-2xl font-bold mb-3">Backend not configured</h1>
          <p className="text-ink-secondary">
            Copy <code>.env.example</code> to <code>.env.local</code> and set{' '}
            <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>{' '}
            (same Supabase project as the mobile app), then restart the dev
            server.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-warm">
        <p className="text-ink-secondary font-medium">Loading InvGen…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/app/login" state={{ from: location.pathname }} replace />;
  }

  // Signed in. The profile row may not exist yet for brand-new sign-ins —
  // RequireVerified treats that as unverified and routes to VerifyGstPage.
  return <Outlet />;
}
