import React, { useState } from 'react';
import { Mail, MessageSquare, Send, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSupabase } from '../../supabase/client';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setStatus('submitting');
    try {
      const { error } = await getSupabase().from('support_queries').insert({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        source: 'contact_page',
        status: 'new'
      });

      if (error) throw error;
      setStatus('success');
      setName('');
      setEmail('');
      setMessage('');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to send message.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6] flex flex-col">
      {/* Navbar */}
      <nav className="h-[72px] bg-surface border-b border-border-color sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 group">
          <img src="/logo.png" alt="InvGen Logo" className="h-8 w-8 object-contain rounded-md border border-border-color shadow-sm group-hover:shadow-md transition-shadow grayscale opacity-80" />
          <span className="text-xl font-bold tracking-tight">InvGen</span>
        </Link>
        <Link to="/" className="text-sm font-semibold text-ink-secondary hover:text-ink flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-4xl grid md:grid-cols-5 gap-8 md:gap-12 bg-surface rounded-[2rem] border border-border-color shadow-sm overflow-hidden">
          
          {/* Left Side: Contact Info */}
          <div className="md:col-span-2 bg-ink p-8 md:p-10 text-surface flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
              <h1 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Get in touch</h1>
              <p className="text-surface/80 text-sm leading-relaxed mb-12">
                Have a question about InvGen? Need help with your account or have a feature request? We'd love to hear from you.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-5 w-5 text-surface" />
                  </div>
                  <div>
                    <p className="text-xs text-surface/60 font-semibold uppercase tracking-wider mb-1">Email us at</p>
                    <a href="mailto:contact.invgen@gmail.com" className="text-base font-medium hover:text-white transition-colors">contact.invgen@gmail.com</a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-5 w-5 text-surface" />
                  </div>
                  <div>
                    <p className="text-xs text-surface/60 font-semibold uppercase tracking-wider mb-1">Support Hours</p>
                    <p className="text-base font-medium">Mon-Fri, 9am - 6pm IST</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Form */}
          <div className="md:col-span-3 p-8 md:p-10 lg:pr-12">
            {status === 'success' ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold">Message Sent!</h2>
                <p className="text-ink-secondary max-w-md">
                  Thank you for reaching out. We've received your message and will get back to you as soon as possible.
                </p>
                <button 
                  onClick={() => setStatus('idle')}
                  className="mt-4 px-6 py-2.5 rounded-xl border border-border-strong font-semibold hover:bg-surface-soft transition-colors"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h2 className="text-xl font-bold mb-6">Send us a message</h2>
                
                {status === 'error' && (
                  <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm font-medium border border-red-100">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold mb-1.5">Your Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full rounded-xl border border-border-strong bg-surface-soft px-4 py-3 outline-none focus:border-ink transition-colors"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-border-strong bg-surface-soft px-4 py-3 outline-none focus:border-ink transition-colors"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Message</label>
                  <textarea
                    required
                    rows={5}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="w-full rounded-xl border border-border-strong bg-surface-soft px-4 py-3 outline-none focus:border-ink transition-colors resize-none"
                    placeholder="How can we help you?"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-ink text-surface font-semibold hover:bg-ink-secondary transition-colors disabled:opacity-70 mt-2"
                >
                  {status === 'submitting' ? 'Sending...' : (
                    <>Send Message <Send className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
