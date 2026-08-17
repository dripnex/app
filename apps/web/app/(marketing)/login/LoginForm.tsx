'use client';

import { useState, type FormEvent } from 'react';
import { URLS } from '@dripnex/product-config';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message || 'Could not send the sign-in link.');
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the sign-in link.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-[360px] rounded-2xl border border-white/[0.08] bg-black/50 p-8 backdrop-blur-xl">
      <img src="/logo.png" alt="" width={40} height={40} className="mb-5 rounded-[8px]" />
      <h1 className="text-[1.35rem] font-medium tracking-tight text-text-primary">Sign in to Dripnex</h1>
      <p className="mt-2.5 mb-6 text-[14px] leading-relaxed text-text-secondary">
        A free account keeps your workspace and AI in one place. You can pay later.
      </p>
      {sent ? (
        <p className="text-[14px] leading-relaxed text-text-secondary">
          Check <strong className="text-text-primary">{email}</strong> for a sign-in link.
        </p>
      ) : (
        <form className="flex flex-col gap-2" onSubmit={e => void submit(e)}>
          <label htmlFor="login-email" className="text-[12px] text-text-muted">
            Email
          </label>
          <input
            id="login-email"
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
            {pending ? 'Sending…' : 'Continue'}
          </button>
        </form>
      )}
    </div>
  );
}
