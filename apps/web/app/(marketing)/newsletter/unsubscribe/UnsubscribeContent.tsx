'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_BASE = 'https://api.dripnex.app';

export default function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const [state, setState] = useState<'loading' | 'success' | 'error' | 'no-email'>('loading');

  useEffect(() => {
    if (!email) {
      setState('no-email');
      return;
    }

    async function unsubscribe() {
      try {
        const res = await fetch(`${API_BASE}/newsletter/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        if (res.ok) {
          setState('success');
        } else {
          setState('error');
        }
      } catch {
        setState('error');
      }
    }

    void unsubscribe();
  }, [email]);

  if (state === 'loading') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-8 h-8 border-[3px] border-white/6 border-t-accent rounded-full animate-spin" />
        <p className="text-[#a1a1aa]">Unsubscribing...</p>
      </div>
    );
  }

  if (state === 'no-email') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <h1 className="text-2xl font-semibold text-[#f4f4f5]">Invalid link</h1>
        <p className="text-[#a1a1aa]">This unsubscribe link is incomplete.</p>
        <Link href="/" className="text-accent hover:underline">
          Go to homepage
        </Link>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <h1 className="text-2xl font-semibold text-[#f4f4f5]">Something went wrong</h1>
        <p className="text-[#a1a1aa]">
          We couldn&apos;t process your request. Please try again or contact{' '}
          <a href="mailto:support@dripnex.app" className="text-accent hover:underline">
            support@dripnex.app
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
      <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-accent/10 flex items-center justify-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="w-8 h-8 text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold text-[#f4f4f5]">You&apos;ve been unsubscribed</h1>
      <p className="text-[#a1a1aa] max-w-md">
        You won&apos;t receive any more emails from us. If this was a mistake, you can re-subscribe
        from our website anytime.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block px-6 py-2.5 bg-accent text-white font-medium rounded-lg transition-colors hover:bg-accent-hover"
      >
        Go to homepage
      </Link>
    </div>
  );
}
