'use client';

import { useState } from 'react';

interface NewsletterFormProps {
  compact?: boolean;
}

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

export default function NewsletterForm({ compact = false }: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email.trim()) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('https://api.readied.app/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Subscription failed. Please try again.');
      }

      setStatus('success');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
    }
  }

  if (status === 'success') {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl border border-green-400/20 bg-green-400/5 px-4 py-3 ${
          compact ? '' : 'mx-auto max-w-md text-center'
        }`}
        role="status"
      >
        <svg
          className="h-5 w-5 shrink-0 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-sm text-green-400">
          You&apos;re subscribed! Check your inbox for a confirmation.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="w-full" noValidate>
        <div className="flex gap-2">
          <label htmlFor="newsletter-email-compact" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email-compact"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={status === 'loading'}
            className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-base px-4 py-2.5 text-sm text-white placeholder-[#71717a] transition-colors focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base disabled:opacity-50"
          >
            {status === 'loading' ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span>Sending...</span>
              </>
            ) : (
              'Subscribe'
            )}
          </button>
        </div>
        {status === 'error' && (
          <p className="mt-2 text-xs text-red-400" role="alert">
            {errorMessage}
          </p>
        )}
      </form>
    );
  }

  return null;
}
