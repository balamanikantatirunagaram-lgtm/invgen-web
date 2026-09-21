import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../stores/session';

/**
 * Verification gate — mirrors mobile router:
 * signed-in users without verification AND without exemption are forced
 * to /app/verify-gst. Exempt (Bill of Supply) accounts pass freely.
 */
export default function RequireVerified() {
  const { profile } = useSession();

  // No profile row yet (fresh signup) counts as unverified.
  if (!profile?.gstVerified && !profile?.gstExempt) {
    return <Navigate to="/app/verify-gst" replace />;
  }
  return <Outlet />;
}
