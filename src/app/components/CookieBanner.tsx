import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('invgen_cookie_consent');
    if (!consent) {
      setIsVisible(true);
    } else if (consent === 'granted') {
      // If they already granted previously, ensure gtag knows on reload
      updateGtagConsent('granted');
    }
  }, []);

  const updateGtagConsent = (status: 'granted' | 'denied') => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        'analytics_storage': status,
        'ad_storage': status
      });
    }
  };

  const handleAccept = () => {
    localStorage.setItem('invgen_cookie_consent', 'granted');
    updateGtagConsent('granted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('invgen_cookie_consent', 'denied');
    updateGtagConsent('denied');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-[100] pointer-events-none">
      <div className="max-w-4xl mx-auto bg-surface border border-border-strong rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pointer-events-auto">
        <div className="flex items-start gap-4">
          <div className="hidden md:flex h-10 w-10 bg-surface-soft rounded-full items-center justify-center flex-shrink-0">
            <Cookie className="h-5 w-5 text-ink-secondary" />
          </div>
          <div>
            <h3 className="font-bold text-ink mb-1">We value your privacy</h3>
            <p className="text-sm text-ink-secondary leading-relaxed max-w-2xl">
              We use essential cookies to make our site work. With your consent, we may also use non-essential cookies 
              (like Google Analytics) to improve user experience and analyze website traffic. 
              By clicking "Accept All", you agree to our website's cookie use as described in our{' '}
              <Link to="/cookie-policy" className="text-ink font-semibold hover:underline">Cookie Policy</Link>.
            </p>
          </div>
        </div>
        <div className="flex w-full md:w-auto items-center gap-3 shrink-0">
          <button 
            onClick={handleDecline}
            className="flex-1 md:flex-none px-5 py-2.5 rounded-xl border border-border-strong text-ink font-semibold hover:bg-surface-soft transition-colors"
          >
            Decline All
          </button>
          <button 
            onClick={handleAccept}
            className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-ink text-surface font-semibold hover:bg-ink-secondary transition-colors"
          >
            Accept All
          </button>
        </div>
        <button 
          onClick={handleDecline} 
          className="absolute top-2 right-2 md:hidden p-2 text-ink-tertiary hover:text-ink"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
