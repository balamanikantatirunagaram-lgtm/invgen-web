import React from 'react';
import { FileText, Calculator, CloudOff, Lock, CheckCircle2, IndianRupee, ArrowRight, Download, Menu, X } from 'lucide-react';

function App() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Navigation */}
      <nav className="bg-white sticky top-0 z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-brand-600" />
              <span className="ml-2 text-xl font-bold text-slate-900 tracking-tight">InvGen</span>
            </div>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-600 hover:text-brand-600 font-medium">Features</a>
              <a href="#how-it-works" className="text-slate-600 hover:text-brand-600 font-medium">How it Works</a>
              <a href="https://app.invgen.com" className="bg-brand-600 text-white px-5 py-2 rounded-full font-medium hover:bg-brand-700 transition-colors">
                Open Web App
              </a>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-slate-600 hover:text-brand-600"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-100 px-4 py-4 space-y-4">
            <a href="#features" className="block text-slate-600 font-medium">Features</a>
            <a href="#how-it-works" className="block text-slate-600 font-medium">How it Works</a>
            <a href="https://app.invgen.com" className="block w-full text-center bg-brand-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-brand-700">
              Open Web App
            </a>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-16 pb-24 lg:pt-24 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight">
              Effortless GST Invoicing for <span className="text-brand-600">Indian Businesses</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
              Generate 100% compliant tax invoices in seconds. Auto-calculates CGST, SGST, IGST, and accurately writes amounts in Crores and Lakhs.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
              <a href="https://app.invgen.com" className="w-full sm:w-auto px-8 py-3.5 border border-transparent text-base font-semibold rounded-full text-white bg-brand-600 hover:bg-brand-700 md:text-lg flex items-center justify-center shadow-lg shadow-brand-500/30 transition-all">
                Create Free Invoice <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <a href="#download" className="w-full sm:w-auto px-8 py-3.5 border border-slate-300 text-base font-semibold rounded-full text-slate-700 bg-white hover:bg-slate-50 md:text-lg flex items-center justify-center transition-all">
                <Download className="mr-2 h-5 w-5" /> Download App
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-500">Available on Web, Android, iOS, and Desktop.</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Everything you need for perfect invoices</h2>
            <p className="mt-4 text-lg text-slate-600">Built specifically to solve the headaches of Indian GST billing.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Calculator className="h-6 w-6 text-brand-600" />}
              title="Smart GST Calculation"
              description="Automatically detects Intra-state vs Inter-state based on GSTIN and splits CGST, SGST, and IGST flawlessly."
            />
            <FeatureCard 
              icon={<IndianRupee className="h-6 w-6 text-brand-600" />}
              title="Indian Amount in Words"
              description="No more manual typing. Converts grand totals into Crores, Lakhs, and Thousands perfectly formatted."
            />
            <FeatureCard 
              icon={<CheckCircle2 className="h-6 w-6 text-brand-600" />}
              title="100% Compliant PDFs"
              description="Generates professional, print-ready PDF invoices formatted strictly according to GST rules."
            />
            <FeatureCard 
              icon={<CloudOff className="h-6 w-6 text-brand-600" />}
              title="Works Offline"
              description="No internet? No problem. Create invoices offline and sync securely when you're back online."
            />
            <FeatureCard 
              icon={<Lock className="h-6 w-6 text-brand-600" />}
              title="Secure & Private"
              description="Your data is isolated and safely stored using enterprise-grade database security rules."
            />
            <FeatureCard 
              icon={<FileText className="h-6 w-6 text-brand-600" />}
              title="Master Data"
              description="Save your products (with HSN) and clients once. Select from dropdowns for 1-click invoicing."
            />
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">How it Works</h2>
            <p className="mt-4 text-lg text-slate-600">Start generating invoices in three simple steps.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 text-center">
            <StepCard 
              step="1"
              title="Setup Profile"
              description="Sign in securely and add your Company details, GSTIN, and Bank Information."
            />
            <StepCard 
              step="2"
              title="Add Items"
              description="Select a saved client and add your products. GST is calculated in real-time."
            />
            <StepCard 
              step="3"
              title="Generate PDF"
              description="Click save to instantly generate a professional PDF ready to share or print."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-brand-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Ready to simplify your billing?</h2>
          <p className="text-brand-100 text-lg mb-10">Join businesses across India generating beautiful, compliant GST invoices effortlessly.</p>
          <a href="https://app.invgen.com" className="inline-flex items-center px-8 py-3.5 border border-transparent text-lg font-bold rounded-full text-brand-700 bg-white hover:bg-brand-50 shadow-lg transition-colors">
            Get Started for Free
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="col-span-2">
              <div className="flex items-center text-white mb-4">
                <FileText className="h-6 w-6 text-brand-500" />
                <span className="ml-2 text-xl font-bold">InvGen</span>
              </div>
              <p className="text-sm">The smartest GST Invoice Generator for Indian Businesses. Built for speed, accuracy, and compliance.</p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="https://app.invgen.com" className="hover:text-white">Web App</a></li>
                <li><a href="#download" className="hover:text-white">Android App</a></li>
                <li><a href="#download" className="hover:text-white">iOS App (Coming Soon)</a></li>
                <li><a href="#download" className="hover:text-white">Desktop App</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-800 text-sm text-center">
            &copy; {new Date().getFullYear()} InvGen. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:shadow-md transition-shadow">
      <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border border-slate-100 mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ step, title, description }: { step: string, title: string, description: string }) {
  return (
    <div className="relative">
      <div className="w-16 h-16 mx-auto bg-brand-100 text-brand-600 rounded-full flex items-center justify-center text-2xl font-bold mb-6">
        {step}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}

export default App;
