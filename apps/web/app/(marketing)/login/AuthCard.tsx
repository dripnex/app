'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { URLS } from '@dripnex/product-config';

type Mode = 'signin' | 'signup';

export default function AuthCard({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`${URLS.apiFallback}/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), client: 'web' }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | null;
        throw new Error(data?.error || data?.message || 'Could not send the email link.');
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the email link.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-[380px] rounded-2xl border border-white/[0.08] bg-black/50 p-8 backdrop-blur-xl">
      <img src="/logo.png" alt="" width={40} height={40} className="mb-5 rounded-[8px]" />
      <div className="mb-5 flex gap-1 rounded-lg bg-white/[0.04] p-1">
        <Link
          href="/login"
          className={`flex-1 rounded-md py-1.5 text-center text-[13px] font-medium ${
            !isSignup ? 'bg-white/[0.08] text-text-primary' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className={`flex-1 rounded-md py-1.5 text-center text-[13px] font-medium ${
            isSignup ? 'bg-white/[0.08] text-text-primary' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Sign up
        </Link>
      </div>
      <h1 className="text-[1.35rem] font-medium tracking-tight text-text-primary">
        {isSignup ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="mt-2.5 mb-6 text-[14px] leading-relaxed text-text-secondary">
        {isSignup
          ? 'Free to start. We’ll email you a link — no password to remember.'
          : 'We’ll email you a one-time link to open your workspace.'}
      </p>
      {sent ? (
        <p className="text-[14px] leading-relaxed text-text-secondary">
          Check <strong className="text-text-primary">{email}</strong>. The link expires in 15
          minutes.
        </p>
      ) : (
        <form className="flex flex-col gap-2" onSubmit={e => void submit(e)}>
          <label htmlFor="auth-email" className="text-[12px] text-text-muted">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2.5 text-[14px] text-text-primary outline-none focus:border-white/25"
          />
          {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-text-primary px-4 py-2.5 text-[13px] font-medium text-background disabled:opacity-60"
          >
            {pending ? 'Sending…' : isSignup ? 'Create account' : 'Email me a link'}
          </button>
          {isSignup ? (
            <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
              By creating an account you agree to the{' '}
              <Link href="/terms" className="underline underline-offset-2 hover:text-text-secondary">
                Terms
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="underline underline-offset-2 hover:text-text-secondary"
              >
                Privacy Policy
              </Link>
              .
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
