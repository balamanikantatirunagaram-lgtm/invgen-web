import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../stores/session';

/**
 * Onboarding gate — Phase B.
 * Verified/exempt users who haven't completed the welcome wizard
 * (onboardedAt == null) are sent to /app/welcome. Skipping sets the
 * timestamp so the redirect doesn't loop.
 */
export default function RequireOnboarded() {
  const { profile, loading } = useSession();

  // While session loads, don't decide — keep user on current route.
  if (loading) return null;

  const needsOnboarding = profile != null && profile.onboardedAt == null;
  if (needsOnboarding) {
    return <Navigate to="/app/welcome" replace />;
  }
  return <Outlet />;
}
