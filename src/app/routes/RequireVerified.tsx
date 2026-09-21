import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../stores/session';

/**
 * GST-verification gate — mirrors mobile router:
 * signed-in but unverified users are forced to /app/verify-gst.
 */
export default function RequireVerified() {
  const { profile } = useSession();

  // No profile row yet (fresh signup) counts as unverified.
  if (!profile?.gstVerified) {
    return <Navigate to="/app/verify-gst" replace />;
  }
  return <Outlet />;
}
