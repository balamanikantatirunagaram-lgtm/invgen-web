import React from 'react';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CookiePolicy() {
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-bg-warm py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link to="/" className="text-ink-secondary hover:text-ink font-semibold flex items-center gap-1 mb-6 transition-colors">
            Back to Home
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 bg-surface border border-border-color rounded-2xl flex items-center justify-center shadow-sm">
              <Shield className="h-6 w-6 text-ink" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Cookie Policy</h1>
          </div>
          <p className="text-ink-secondary">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        <div className="bg-surface border border-border-color rounded-3xl p-6 sm:p-10 shadow-sm space-y-8 text-ink leading-relaxed">
          
          <section>
            <h2 className="text-2xl font-bold mb-4">1. What are cookies?</h2>
            <p className="text-ink-secondary">
              Cookies are small text files that are placed on your computer or mobile device when you visit a website. 
              They are widely used to make websites work, or work more efficiently, as well as to provide reporting information 
              and assist with service personalization.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. How we use cookies</h2>
            <p className="text-ink-secondary mb-4">
              We use cookies for two primary purposes:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-ink-secondary">
              <li><strong>Essential Cookies:</strong> These are required for the operation of our web application. They include, for example, cookies that enable you to log into secure areas like your invoicing dashboard (handled via Supabase) and save your basic site preferences.</li>
              <li><strong>Analytics Cookies:</strong> We use Google Analytics to help us understand how visitors interact with our website. This helps us improve our website's structure and content. These cookies collect information in an anonymous form, including the number of visitors to the site, where visitors have come to the site from, and the pages they visited.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. Third-Party Cookies (Google Analytics)</h2>
            <p className="text-ink-secondary mb-4">
              We use Google Analytics (`gtag.js`) to measure traffic and usage trends. Google Analytics may set cookies on your browser or read cookies that are already there. 
            </p>
            <p className="text-ink-secondary">
              We operate with Google Consent Mode. This means Google Analytics cookies will only be set on your device if you explicitly click "Accept All" on our cookie consent banner. If you decline, analytics storage is disabled.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. Managing your cookie preferences</h2>
            <p className="text-ink-secondary mb-4">
              You have the right to decide whether to accept or reject non-essential cookies. You can exercise your cookie preferences by clicking the appropriate buttons on our cookie banner.
            </p>
            <p className="text-ink-secondary">
              Additionally, most web browsers allow you to control cookies through their settings preferences. To find out more about cookies, including how to see what cookies have been set, visit www.aboutcookies.org or www.allaboutcookies.org.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">5. Updates to this policy</h2>
            <p className="text-ink-secondary">
              We may update this Cookie Policy from time to time in order to reflect changes to the cookies we use or for other operational, legal, or regulatory reasons. Please revisit this Cookie Policy regularly to stay informed about our use of cookies and related technologies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">6. Contact us</h2>
            <p className="text-ink-secondary">
              If you have any questions about our use of cookies or other technologies, please contact us at: <a href="mailto:contact.invgen@gmail.com" className="text-blue-600 hover:underline">contact.invgen@gmail.com</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
