import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen font-sans bg-bg-warm py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center text-ink-secondary hover:text-ink mb-12 transition-colors">
          <ArrowLeft className="mr-2 h-5 w-5" /> Back to Home
        </Link>
        
        <h1 className="text-5xl font-bold tracking-tight mb-4">Terms of Service</h1>
        <p className="text-ink-secondary mb-12">Last updated: September 2026</p>

        <div className="bg-surface border border-border-color rounded-3xl p-8 sm:p-12 shadow-sm space-y-10">
          <section>
            <h2 className="text-2xl font-bold mb-4">1. What this app does</h2>
            <p className="text-ink-secondary leading-relaxed">
              A GST invoice generator. Tax calculations follow standard CGST/SGST/IGST rules, but you are responsible for filing and legal compliance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. Your responsibilities</h2>
            <p className="text-ink-secondary leading-relaxed">
              Keep invoice numbers sequential, verify party GSTINs, and confirm tax treatment with your CA. Verify fetched registry details before use.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. Verification service</h2>
            <p className="text-ink-secondary leading-relaxed">
              GST lookups use a third-party registry API; availability and accuracy depend on that provider. Lookups may be cached for 24 hours.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. Acceptable use</h2>
            <p className="text-ink-secondary leading-relaxed">
              Use only for lawful invoicing. Do not attempt to access other users' data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">5. Liability</h2>
            <p className="text-ink-secondary leading-relaxed">
              Provided “as is” without warranties. To the extent permitted by law, we are not liable for filing errors, penalties or data loss. Keep your own backups of critical records.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">6. Termination</h2>
            <p className="text-ink-secondary leading-relaxed">
              You may delete your account at any time (Settings → Delete account), which erases your data as described in the Privacy Policy.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
