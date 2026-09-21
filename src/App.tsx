import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Calculator, CloudOff, Lock, CheckCircle2, IndianRupee, ArrowRight, Download, Menu, X, FileText, Check } from 'lucide-react';
import PrivacyPolicy from './PrivacyPolicy';
import TermsOfService from './TermsOfService';
import RequireAuth from './app/routes/RequireAuth';
import RequireVerified from './app/routes/RequireVerified';
import RequireOnboarded from './app/routes/RequireOnboarded';
import AppShell from './app/routes/AppShell';
import LoginPage from './app/features/auth/LoginPage';
import VerifyGstPage from './app/features/auth/VerifyGstPage';
import WelcomeWizard from './app/features/onboarding/WelcomeWizard';
import DashboardPage from './app/features/dashboard/DashboardPage';
import BuilderPage from './app/features/invoices/BuilderPage';
import LedgerPage from './app/features/invoices/LedgerPage';

// Lazy: @react-pdf/renderer is heavy — split it out of the main bundle.
const PdfPreviewPage = React.lazy(() => import('./app/features/invoices/PdfPreviewPage'));

function PdfPreviewSuspense() {
  return (
    <React.Suspense
      fallback={
        <div className="bg-surface border border-border-color rounded-2xl p-12 text-center">
          <p className="text-ink-secondary font-medium">Loading PDF viewer…</p>
        </div>
      }
    >
      <PdfPreviewPage />
    </React.Suspense>
  );
}
import ClientsPage from './app/features/clients/ClientsPage';
import ProductsPage from './app/features/products/ProductsPage';
import SettingsHubPage, {
  BankSettingsPage,
  CompanySettingsPage,
  InvoicingSettingsPage,
} from './app/features/settings/SettingsPages';

function App() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const location = useLocation();

  // Scroll to top on route change
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Landing chrome only outside the authenticated app (/app/* has its own shell).
  const isApp = location.pathname.startsWith('/app');

  return (
    <div className="min-h-screen font-sans">
      {/* Navigation */}
      {!isApp && (
      <nav className="bg-bg-warm sticky top-0 z-50 border-b border-border-color">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center">
              <img src="/logo.png" alt="InvGen Logo" className="h-10 w-10 object-contain rounded-lg border border-border-color shadow-sm" />
              <span className="ml-3 text-2xl font-bold tracking-tight">InvGen</span>
            </Link>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-8">
              <Link to="/#features" className="text-ink hover:text-ink-secondary font-medium transition-colors">Features</Link>
              <Link to="/#how-it-works" className="text-ink hover:text-ink-secondary font-medium transition-colors">How it Works</Link>
              <Link to="/#templates" className="text-ink hover:text-ink-secondary font-medium transition-colors">Templates</Link>
              <Link to="/#pricing" className="text-ink hover:text-ink-secondary font-medium transition-colors">Pricing</Link>
              <Link to="/app/login" className="text-ink hover:text-ink-secondary font-medium transition-colors">Login</Link>
              <Link to="/app/login" className="bg-ink text-surface px-6 py-2.5 rounded-xl font-semibold hover:bg-ink-secondary transition-all shadow-sm">
                Get Started
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-ink hover:text-ink-secondary"
              >
                {isMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden bg-surface border-b border-border-color px-4 py-4 space-y-4">
            <Link to="/#features" onClick={() => setIsMenuOpen(false)} className="block text-ink font-medium">Features</Link>
            <Link to="/#how-it-works" onClick={() => setIsMenuOpen(false)} className="block text-ink font-medium">How it Works</Link>
            <Link to="/#templates" onClick={() => setIsMenuOpen(false)} className="block text-ink font-medium">Templates</Link>
            <Link to="/#pricing" onClick={() => setIsMenuOpen(false)} className="block text-ink font-medium">Pricing</Link>
            <Link to="/app/login" onClick={() => setIsMenuOpen(false)} className="block text-ink font-medium">Login</Link>
            <Link to="/app/login" onClick={() => setIsMenuOpen(false)} className="block w-full text-center bg-ink text-surface px-5 py-3 rounded-xl font-medium">
              Get Started
            </Link>
          </div>
        )}
      </nav>
      )}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />

        {/* Web app (same Supabase backend as mobile) */}
        <Route path="/app/login" element={<LoginPage />} />
        <Route path="/app/verify-gst" element={<VerifyGstPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<RequireVerified />}>
            <Route path="/app/welcome" element={<WelcomeWizard />} />
            <Route element={<RequireOnboarded />}>
              <Route element={<AppShell />}>
                <Route path="/app" element={<DashboardPage />} />
                <Route path="/app/dashboard" element={<DashboardPage />} />
                <Route path="/app/invoices/new" element={<BuilderPage />} />
                <Route path="/app/invoices/:id/edit" element={<BuilderPage />} />
                <Route path="/app/invoices" element={<LedgerPage />} />
                <Route path="/app/invoices/:id" element={<PdfPreviewSuspense />} />
                <Route path="/app/clients" element={<ClientsPage />} />
                <Route path="/app/products" element={<ProductsPage />} />
                <Route path="/app/settings" element={<SettingsHubPage />} />
                <Route path="/app/settings/company" element={<CompanySettingsPage />} />
                <Route path="/app/settings/bank" element={<BankSettingsPage />} />
                <Route path="/app/settings/invoicing" element={<InvoicingSettingsPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>

      {/* Footer */}
      {!isApp && (
      <footer className="bg-bg-warm py-16 border-t border-border-color">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 md:gap-8">
            <div className="col-span-2">
              <div className="flex items-center mb-6">
                <img src="/logo.png" alt="InvGen Logo" className="h-8 w-8 object-contain rounded-md border border-border-color shadow-sm grayscale opacity-80" />
                <span className="ml-3 text-xl font-bold">InvGen</span>
              </div>
              <p className="text-ink-secondary max-w-sm">The smartest GST Invoice Generator for Indian Businesses. Built for speed, accuracy, and compliance.</p>
            </div>
            <div>
              <h3 className="font-semibold text-ink mb-6 uppercase tracking-wider text-sm">Product</h3>
              <ul className="space-y-3">
                <li><Link to="/app/login" className="text-ink-secondary hover:text-ink transition-colors">Web App</Link></li>
                <li><a href="#download" className="text-ink-secondary hover:text-ink transition-colors">Android App</a></li>
                <li><a href="#download" className="text-ink-secondary hover:text-ink transition-colors">iOS App</a></li>
                <li><a href="#download" className="text-ink-secondary hover:text-ink transition-colors">Desktop App</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-ink mb-6 uppercase tracking-wider text-sm">Legal</h3>
              <ul className="space-y-3">
                <li><Link to="/privacy-policy" className="text-ink-secondary hover:text-ink transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-ink-secondary hover:text-ink transition-colors">Terms of Service</Link></li>
                <li><a href="mailto:support@invgen.com" className="text-ink-secondary hover:text-ink transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-border-color text-ink-tertiary flex flex-col md:flex-row justify-between items-center">
            <p>&copy; {new Date().getFullYear()} InvGen. All rights reserved.</p>
            <p className="mt-2 md:mt-0 font-medium">Built in India 🇮🇳</p>
          </div>
        </div>
      </footer>
      )}
    </div>
  );
}

function Home() {
  const location = useLocation();

  React.useEffect(() => {
    if (location.hash) {
      const element = document.getElementById(location.hash.replace('#', ''));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [location]);

  return (
    <>
      {/* Hero Section */}
      <section className="pt-20 pb-28 lg:pt-32 lg:pb-40 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight">
              Premium GST Invoicing for Indian Businesses
            </h1>
            <p className="mt-8 text-xl text-ink-secondary max-w-2xl mx-auto leading-relaxed">
              Generate 100% compliant tax invoices in seconds. Auto-calculates CGST, SGST, IGST, and accurately formats amounts in Crores and Lakhs.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link to="/app/login" className="w-full sm:w-auto px-8 py-4 text-lg font-semibold rounded-xl text-surface bg-ink hover:bg-ink-secondary flex items-center justify-center transition-all shadow-md">
                Create Free Invoice <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <a href="#download" className="w-full sm:w-auto px-8 py-4 border border-border-strong text-lg font-semibold rounded-xl text-ink bg-surface hover:bg-surface-soft flex items-center justify-center transition-all">
                <Download className="mr-2 h-5 w-5" /> Download App
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-surface border-y border-border-color">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold tracking-tight">Everything you need. Nothing you don't.</h2>
            <p className="mt-5 text-lg text-ink-secondary">Built from the ground up to solve the exact headaches of Indian GST billing with zero clutter.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Calculator className="h-6 w-6 text-ink" />}
              title="Smart GST Math"
              description="Automatically detects Intra-state vs Inter-state based on GSTIN and splits CGST, SGST, and IGST flawlessly."
            />
            <FeatureCard 
              icon={<IndianRupee className="h-6 w-6 text-ink" />}
              title="Indian Number Formats"
              description="No more manual typing. Converts grand totals into Crores, Lakhs, and Thousands perfectly formatted."
            />
            <FeatureCard 
              icon={<CheckCircle2 className="h-6 w-6 text-ink" />}
              title="100% Compliant PDFs"
              description="Generates professional, print-ready PDF invoices formatted strictly according to Indian GST rules."
            />
            <FeatureCard 
              icon={<CloudOff className="h-6 w-6 text-ink" />}
              title="Offline-First"
              description="No internet? No problem. Create invoices offline and sync securely when you're back online."
            />
            <FeatureCard 
              icon={<Lock className="h-6 w-6 text-ink" />}
              title="Enterprise Security"
              description="Your data is isolated and safely stored using enterprise-grade Supabase security rules."
            />
            <FeatureCard 
              icon={<FileText className="h-6 w-6 text-ink" />}
              title="Master Data Memory"
              description="Save your products (with HSN) and clients once. Select from dropdowns for 1-click invoicing."
            />
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-24 bg-bg-warm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight">How it Works</h2>
            <p className="mt-5 text-lg text-ink-secondary">Start generating invoices in three simple steps.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <StepCard 
              step="01"
              title="Setup Profile"
              description="Sign in securely and add your Company details, GSTIN, and Bank Information."
            />
            <StepCard 
              step="02"
              title="Add Items"
              description="Select a saved client and add your products. GST and amounts in words are calculated in real-time."
            />
            <StepCard 
              step="03"
              title="Generate PDF"
              description="Click save to instantly generate a professional, print-ready PDF invoice."
            />
          </div>
        </div>
      </section>

      {/* Templates Section */}
      <section id="templates" className="py-24 bg-surface border-y border-border-color">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight">Professional Templates</h2>
            <p className="mt-5 text-lg text-ink-secondary">Choose from minimal, print-friendly formats that represent your brand.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl border border-border-color bg-surface-soft p-4 flex flex-col items-center group cursor-pointer hover:border-ink transition-colors">
                <div className="w-full aspect-[1/1.4] bg-surface rounded-xl shadow-sm border border-border-color mb-4 overflow-hidden relative">
                   <div className="absolute inset-0 flex flex-col p-4 opacity-50">
                     <div className="h-4 w-1/2 bg-border-strong rounded mb-2"></div>
                     <div className="h-2 w-1/3 bg-border-color rounded mb-8"></div>
                     <div className="flex-1 border border-border-color rounded bg-bg-warm/50"></div>
                   </div>
                </div>
                <h3 className="font-semibold text-ink">Template 0{i}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-bg-warm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight">Simple, Transparent Pricing</h2>
            <p className="mt-5 text-lg text-ink-secondary">Pay only for what you use. No hidden fees.</p>
          </div>
          
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
            <div className="bg-surface border border-border-color rounded-3xl p-10 shadow-sm flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Free Tier</h3>
              <p className="text-ink-secondary mb-6">Perfect for freelancers and small businesses.</p>
              <div className="text-4xl font-bold mb-8">₹0 <span className="text-lg text-ink-tertiary font-normal">/month</span></div>
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center"><Check className="h-5 w-5 text-ink mr-3" /> Up to 20 invoices/month</li>
                <li className="flex items-center"><Check className="h-5 w-5 text-ink mr-3" /> Standard Template</li>
                <li className="flex items-center"><Check className="h-5 w-5 text-ink mr-3" /> PDF Export</li>
                <li className="flex items-center"><Check className="h-5 w-5 text-ink mr-3" /> Offline Mode</li>
              </ul>
              <a href="#" className="block w-full py-4 text-center rounded-xl border border-border-strong font-semibold hover:bg-surface-soft transition-colors">Current Plan</a>
            </div>
            
            <div className="bg-ink text-surface rounded-3xl p-10 shadow-xl flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-surface text-ink text-xs font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-wider">Most Popular</div>
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <p className="text-ink-tertiary mb-6">For growing businesses with higher volume.</p>
              <div className="text-4xl font-bold mb-8">₹499 <span className="text-lg text-ink-tertiary font-normal">/month</span></div>
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center"><Check className="h-5 w-5 text-surface mr-3" /> Unlimited invoices</li>
                <li className="flex items-center"><Check className="h-5 w-5 text-surface mr-3" /> All Premium Templates</li>
                <li className="flex items-center"><Check className="h-5 w-5 text-surface mr-3" /> Custom Logo Uploads</li>
                <li className="flex items-center"><Check className="h-5 w-5 text-surface mr-3" /> Priority Support</li>
              </ul>
              <a href="#" className="block w-full py-4 text-center rounded-xl bg-surface text-ink font-semibold hover:bg-surface-soft transition-colors">Upgrade to Pro</a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-surface border-y border-border-color">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold tracking-tight mb-6">Ready to simplify your billing?</h2>
          <p className="text-ink-secondary text-xl mb-10">Join businesses across India generating beautiful, compliant GST invoices effortlessly.</p>
          <Link to="/app/login" className="inline-flex items-center px-8 py-4 font-bold rounded-xl text-surface bg-ink hover:bg-ink-secondary shadow-md transition-all text-lg">
            Get Started for Free
          </Link>
        </div>
      </section>
    </>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-surface rounded-3xl p-8 border border-border-color hover:shadow-xl hover:shadow-ink/5 transition-all group">
      <div className="w-14 h-14 rounded-2xl bg-surface-soft border border-border-color flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-ink mb-3">{title}</h3>
      <p className="text-ink-secondary leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ step, title, description }: { step: string, title: string, description: string }) {
  return (
    <div className="relative text-center md:text-left flex flex-col items-center md:items-start">
      <div className="text-5xl font-extrabold text-border-strong mb-6 font-mono tracking-tighter">
        {step}
      </div>
      <h3 className="text-xl font-bold text-ink mb-3">{title}</h3>
      <p className="text-ink-secondary">{description}</p>
    </div>
  );
}

export default App;
