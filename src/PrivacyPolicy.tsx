import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen font-sans bg-bg-warm py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center text-ink-secondary hover:text-ink mb-12 transition-colors">
          <ArrowLeft className="mr-2 h-5 w-5" /> Back to Home
        </Link>
        
        <h1 className="text-5xl font-bold tracking-tight mb-4">Privacy Policy</h1>
        <p className="text-ink-secondary mb-12">Last updated: September 2026</p>

        <div className="bg-surface border border-border-color rounded-3xl p-8 sm:p-12 shadow-sm space-y-10">
          <section>
            <h2 className="text-2xl font-bold mb-4">1. Data we collect</h2>
            <p className="text-ink-secondary leading-relaxed">
              <strong>Account:</strong> name, email and profile photo from Google Sign-In.<br/>
              <strong>Business:</strong> company name, address, GSTIN, bank details you enter.<br/>
              <strong>Parties & invoices:</strong> client details and invoice records you create.<br/>
              <strong>Verification:</strong> GSTINs you look up via the GST verification service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. Why we collect it</h2>
            <p className="text-ink-secondary leading-relaxed">
              To operate the invoice generator: sync your data across devices, prefill invoices, and verify GSTINs at your request. Analytics logs counts only (invoices created, PDFs exported) — never names, GSTINs, amounts or addresses.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. Where data lives</h2>
            <p className="text-ink-secondary leading-relaxed">
              Supabase (Postgres): Authentication and your business data. Data is stored in your Supabase project region and protected by row-level security rules scoped to your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. Sharing</h2>
            <p className="text-ink-secondary leading-relaxed">
              GSTINs you verify are sent to our verification provider (Appyflow) solely to fetch public registry details. We do not sell data or share it with advertisers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">5. Your rights (DPDP Act 2023)</h2>
            <p className="text-ink-secondary leading-relaxed">
              Access, correction and erasure: edit everything in-app; permanently erase your account and all associated data via Settings → Delete account. Grievances: contact support from the Settings screen.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">6. Retention</h2>
            <p className="text-ink-secondary leading-relaxed">
              Data is kept while your account exists and deleted with it. Cancelled invoices are retained as immutable records until you delete your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">7. Children</h2>
            <p className="text-ink-secondary leading-relaxed">
              This app is for business use and not directed at children under 18.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
