import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePlus2,
  ReceiptText,
  Users,
  Package,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { getSupabase } from '../supabase/client';
import { useSession } from '../stores/session';
import { useSubscribeTables } from '../hooks/queries';
import { Toaster } from '../components/toast';

const NAV = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/invoices/new', label: 'New Invoice', icon: FilePlus2, end: true },
  { to: '/app/invoices', label: 'Invoices', icon: ReceiptText, end: true },
  { to: '/app/clients', label: 'Clients', icon: Users, end: true },
  { to: '/app/products', label: 'Products', icon: Package, end: true },
  // Settings stays prefix-active so it highlights on /app/settings/* children.
  { to: '/app/settings', label: 'Settings', icon: Settings, end: false },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-colors ${
    isActive
      ? 'bg-ink text-surface'
      : 'text-ink-secondary hover:text-ink hover:bg-surface-soft'
  }`;
}

/** Desktop SaaS shell: sidebar + topbar. Deliberately different from mobile UI. */
export default function AppShell() {
  const [open, setOpen] = useState(false);
  const { user } = useSession();
  const navigate = useNavigate();
  useSubscribeTables();

  const signOut = async () => {
    await getSupabase().auth.signOut();
    useSession.getState().signOut();
    navigate('/', { replace: true });
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      <Link to="/app/dashboard" className="flex items-center px-4 py-6">
        <img
          src="/logo.png"
          alt="InvGen"
          className="h-9 w-9 object-contain rounded-lg border border-border-color"
        />
        <span className="ml-3 text-xl font-bold tracking-tight">InvGen</span>
      </Link>
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navClass} onClick={() => setOpen(false)}>
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-border-color">
        <div className="flex items-center gap-3 px-2 mb-3">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="h-9 w-9 rounded-full" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-surface-soft border border-border-color flex items-center justify-center font-bold">
              {(user?.displayName ?? 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{user?.displayName}</p>
            <p className="text-xs text-ink-tertiary truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-ink-secondary hover:text-ink hover:bg-surface-soft font-medium transition-colors"
        >
          <LogOut className="h-5 w-5" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-warm">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-surface border-r border-border-color">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface border-r border-border-color">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-5 right-4 text-ink-secondary"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-40 bg-bg-warm/90 backdrop-blur border-b border-border-color">
          <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 h-16">
            <button
              onClick={() => setOpen(true)}
              className="lg:hidden text-ink"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Link
              to="/app/invoices/new"
              className="ml-auto bg-ink text-surface px-5 py-2 rounded-xl text-sm font-semibold hover:bg-ink-secondary transition-colors"
            >
              + New Invoice
            </Link>
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto">
          <Outlet />
        </main>
        <Toaster />
      </div>
    </div>
  );
}
