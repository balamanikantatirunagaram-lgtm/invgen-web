import { create } from 'zustand';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

export interface UserProfile {
  gstVerified: boolean;
  /** Non-GST (Bill of Supply) mode — passes guards without verification. */
  gstExempt: boolean;
  gstin: string | null;
  onboardedAt: Date | null;
}

interface SessionState {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
  setSession: (user: AppUser | null, profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
}

/** Minimal session store. Supabase owns the session; this mirrors it for routing. */
export const useSession = create<SessionState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  setSession: (user, profile) => set({ user, profile, loading: false }),
  setLoading: (loading) => set({ loading }),
  signOut: () => set({ user: null, profile: null, loading: false }),
}));
