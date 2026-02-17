import { useState, useEffect, type FormEvent } from 'react';

interface Plan {
  name: string;
  features: string[];
}

interface ProPlan extends Plan {
  pricing: {
    monthly: number;
    annual: number;
  };
}

interface SubscribeFlowProps {
  trialDays: number;
  plans: {
    free: Plan;
    pro: ProPlan;
  };
  guarantees: {
    refund: string;
    cancelAnytime: string;
    noLockIn: string;
  };
}

type Step = 1 | 2 | 3;
type SubmitStatus = 'idle' | 'loading' | 'error';

export default function SubscribeFlow({ trialDays, plans, guarantees }: SubscribeFlowProps) {
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro-monthly' | 'pro-annual'>('free');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get('verified');
    const urlToken = params.get('token');

    if (verified === 'true' && urlToken) {
      setToken(urlToken);
      setStep(3);
    }
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function handleEmailSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('https://api.readied.app/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Failed to send magic link. Please try again.');
      }

      setStatus('idle');
      setStep(2);
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('https://api.readied.app/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Failed to resend. Please try again.');
      }

      setStatus('idle');
      setResendCooldown(60);
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
    }
  }

  async function handlePlanSelect() {
    if (selectedPlan === 'free') {
      window.location.href = '/download';
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('https://api.readied.app/subscription/checkout/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          plan: selectedPlan === 'pro-monthly' ? 'monthly' : 'annual',
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Failed to start checkout. Please try again.');
      }

      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
    }
  }

  function StepIndicator() {
    const steps = [
      { num: 1, label: 'Email' },
      { num: 2, label: 'Verify' },
      { num: 3, label: 'Plan' },
    ] as const;

    return (
      <nav className="mb-8 flex items-center justify-center gap-2" aria-label="Subscribe steps">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                step > s.num
                  ? 'bg-green-400 text-white'
                  : step === s.num
                    ? 'bg-accent text-white'
                    : 'border border-white/[0.08] bg-surface text-[#71717a]'
              }`}
              aria-current={step === s.num ? 'step' : undefined}
            >
              {step > s.num ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                s.num
              )}
            </div>
            <span
              className={`hidden text-xs sm:inline ${
                step >= s.num ? 'text-[#a1a1aa]' : 'text-[#71717a]'
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`mx-1 h-px w-8 sm:w-12 ${
                  step > s.num ? 'bg-green-400/50' : 'bg-white/[0.08]'
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </nav>
    );
  }

  function LoadingSpinner() {
    return (
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
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <StepIndicator />

      {/* Step 1: Email entry */}
      {step === 1 && (
        <div className="rounded-xl border border-white/[0.06] bg-surface p-8">
          <h2 className="mb-2 text-center text-xl font-semibold text-white">Get started</h2>
          <p className="mb-6 text-center text-sm text-[#71717a]">
            Enter your email to begin. We'll send you a magic link to verify.
          </p>

          <form onSubmit={handleEmailSubmit} noValidate>
            <div className="space-y-4">
              <div>
                <label htmlFor="subscribe-email" className="mb-1.5 block text-sm font-medium text-[#a1a1aa]">
                  Email address
                </label>
                <input
                  id="subscribe-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  disabled={status === 'loading'}
                  className="w-full rounded-lg border border-white/[0.08] bg-base px-4 py-3 text-sm text-white placeholder-[#71717a] transition-colors focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading' || !email.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50"
              >
                {status === 'loading' ? (
                  <>
                    <LoadingSpinner />
                    <span>Sending link...</span>
                  </>
                ) : (
                  'Continue with email'
                )}
              </button>
            </div>

            {status === 'error' && (
              <p className="mt-3 text-center text-xs text-red-400" role="alert">
                {errorMessage}
              </p>
            )}
          </form>

          <p className="mt-4 text-center text-xs text-[#71717a]">
            No password needed. We'll send a secure login link.
          </p>
        </div>
      )}

      {/* Step 2: Check email */}
      {step === 2 && (
        <div className="rounded-xl border border-white/[0.06] bg-surface p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
            <svg
              className="h-8 w-8 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>

          <h2 className="mb-2 text-xl font-semibold text-white">Check your email</h2>
          <p className="mb-1 text-sm text-[#71717a]">
            We sent a verification link to
          </p>
          <p className="mb-6 text-sm font-medium text-[#a1a1aa]">{email}</p>

          <p className="mb-4 text-xs text-[#71717a]">
            Click the link in the email to continue. Check your spam folder if you don't see it.
          </p>

          <button
            type="button"
            onClick={handleResend}
            disabled={status === 'loading' || resendCooldown > 0}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-elevated px-4 py-2.5 text-sm text-[#a1a1aa] transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            {status === 'loading' ? (
              <>
                <LoadingSpinner />
                <span>Resending...</span>
              </>
            ) : resendCooldown > 0 ? (
              `Resend in ${resendCooldown}s`
            ) : (
              'Resend email'
            )}
          </button>

          {status === 'error' && (
            <p className="mt-3 text-xs text-red-400" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="mt-6 border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setStatus('idle');
                setErrorMessage('');
              }}
              className="text-xs text-[#71717a] transition-colors hover:text-[#a1a1aa]"
            >
              Use a different email
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Plan selection */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold text-white">Choose your plan</h2>
            <p className="text-sm text-[#71717a]">
              Start with a {trialDays}-day free trial of Pro. Cancel anytime.
            </p>
          </div>

          {/* Plan cards */}
          <div className="space-y-3">
            {/* Free plan */}
            <button
              type="button"
              onClick={() => setSelectedPlan('free')}
              className={`w-full rounded-xl border p-5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                selectedPlan === 'free'
                  ? 'border-accent/50 bg-accent/5'
                  : 'border-white/[0.08] bg-surface hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">{plans.free.name}</h3>
                  <p className="mt-0.5 text-sm text-[#71717a]">Free forever</p>
                </div>
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                    selectedPlan === 'free'
                      ? 'border-accent bg-accent'
                      : 'border-white/20'
                  }`}
                >
                  {selectedPlan === 'free' && (
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {plans.free.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[#71717a]">
                    <svg
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#71717a]"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </button>

            {/* Pro Monthly */}
            <button
              type="button"
              onClick={() => setSelectedPlan('pro-monthly')}
              className={`w-full rounded-xl border p-5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                selectedPlan === 'pro-monthly'
                  ? 'border-accent/50 bg-accent/5'
                  : 'border-white/[0.08] bg-surface hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">{plans.pro.name}</h3>
                  <p className="mt-0.5 font-mono text-sm text-[#71717a]">
                    ${plans.pro.pricing.monthly}/month
                  </p>
                </div>
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                    selectedPlan === 'pro-monthly'
                      ? 'border-accent bg-accent'
                      : 'border-white/20'
                  }`}
                >
                  {selectedPlan === 'pro-monthly' && (
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {plans.pro.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[#71717a]">
                    <svg
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </button>

            {/* Pro Annual */}
            <button
              type="button"
              onClick={() => setSelectedPlan('pro-annual')}
              className={`relative w-full rounded-xl border p-5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                selectedPlan === 'pro-annual'
                  ? 'border-accent/50 bg-accent/5'
                  : 'border-white/[0.08] bg-surface hover:border-white/[0.12]'
              }`}
            >
              <span className="absolute -top-2.5 right-4 rounded-full bg-accent px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                Save {Math.round((1 - (plans.pro.pricing.annual / 12) / plans.pro.pricing.monthly) * 100)}%
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">{plans.pro.name} Annual</h3>
                  <p className="mt-0.5 font-mono text-sm text-[#71717a]">
                    ${(plans.pro.pricing.annual / 12).toFixed(2)}/month, billed annually
                  </p>
                </div>
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                    selectedPlan === 'pro-annual'
                      ? 'border-accent bg-accent'
                      : 'border-white/20'
                  }`}
                >
                  {selectedPlan === 'pro-annual' && (
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* Continue button */}
          <button
            type="button"
            onClick={handlePlanSelect}
            disabled={status === 'loading'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base disabled:opacity-50"
          >
            {status === 'loading' ? (
              <>
                <LoadingSpinner />
                <span>Processing...</span>
              </>
            ) : selectedPlan === 'free' ? (
              'Download Readied'
            ) : (
              `Start ${trialDays}-day free trial`
            )}
          </button>

          {status === 'error' && (
            <p className="text-center text-xs text-red-400" role="alert">
              {errorMessage}
            </p>
          )}

          {/* Guarantees */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[#71717a]">
            <span className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
              {guarantees.refund}
            </span>
            <span className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {guarantees.cancelAnytime}
            </span>
            <span className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {guarantees.noLockIn}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
