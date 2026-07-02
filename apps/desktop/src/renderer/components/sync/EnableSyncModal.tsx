/**
 * Enable Sync Modal
 *
 * Guides the user through enabling cloud sync with license-aware step routing.
 * Computes smart initial step based on auth + license state:
 *   - Auth'd + pro/trial → success (already syncing)
 *   - Auth'd + free/expired → pricing (needs subscription)
 *   - Not auth'd + trial/pro → email (just needs to sign in)
 *   - Not auth'd + free/expired → value-prop (full flow)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Cloud, Mail, CheckCircle, X, RefreshCw, Sparkles } from 'lucide-react';
import { getProductConfig } from '@dripnex/product-config';
import { useAuthStore, selectIsAuthenticated, selectError } from '../../stores/authStore';
import { useLicense } from '../../contexts/LicenseContext';
import styles from './LoginModal.module.css';

interface EnableSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step =
  | 'value-prop'
  | 'pricing'
  | 'waiting-payment'
  | 'email'
  | 'checking'
  | 'sent'
  | 'success';

const RESEND_COOLDOWN = 60; // seconds

const SYNC_CAPABLE_STATUSES = ['trial', 'pro_active', 'pro_grace'];

function hasSyncCapability(status: string | undefined): boolean {
  return status != null && SYNC_CAPABLE_STATUSES.includes(status);
}

export function EnableSyncModal({ isOpen, onClose }: EnableSyncModalProps) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('value-prop');
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestMagicLink = useAuthStore(state => state.requestMagicLink);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const authError = useAuthStore(selectError);
  const { state: licenseState, openSubscribe } = useLicense();
  const config = useMemo(() => getProductConfig(), []);
  const proPricing = config.plans.pro.pricing!;

  const canSync = hasSyncCapability(licenseState?.status);

  // Compute smart initial step based on current auth + license state
  // Note: checkout requires auth, so unauthenticated users always go through email first
  const computeInitialStep = useCallback((): Step => {
    if (isAuthenticated && canSync) return 'success';
    if (isAuthenticated && !canSync) return 'pricing';
    // Not authenticated — always need to sign in first (checkout requires auth)
    return 'value-prop';
  }, [isAuthenticated, canSync]);

  // Watch for auth success (deep link verified in background)
  // If user has sync capability → success. If not → they need to pay first.
  useEffect(() => {
    if (isAuthenticated && (step === 'sent' || step === 'checking')) {
      if (canSync) {
        setStep('success');
      } else {
        setStep('pricing');
      }
    }
  }, [isAuthenticated, canSync, step]);

  // Watch for verification errors from the deep link path
  useEffect(() => {
    if (authError && step === 'sent') {
      setError(authError);
    }
  }, [authError, step]);

  // Watch for license state changes while waiting for payment
  useEffect(() => {
    if (step === 'waiting-payment' && hasSyncCapability(licenseState?.status)) {
      if (isAuthenticated) {
        setStep('success');
      } else {
        setStep('email');
      }
    }
  }, [licenseState?.status, step, isAuthenticated]);

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setInterval(() => {
        setResendTimer(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [resendTimer]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(computeInitialStep());
      setEmail('');
      setError(null);
      setResendTimer(0);
    }
  }, [isOpen, computeInitialStep]);

  const handleSubmitEmail = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setStep('checking');

      try {
        await requestMagicLink(email);
        setStep('sent');
        setResendTimer(RESEND_COOLDOWN);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send magic link');
        setStep('email');
      }
    },
    [email, requestMagicLink]
  );

  const handleResend = useCallback(async () => {
    if (resendTimer > 0 || isResending) return;
    setError(null);
    setIsResending(true);

    try {
      await requestMagicLink(email);
      setResendTimer(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend');
    } finally {
      setIsResending(false);
    }
  }, [email, resendTimer, isResending, requestMagicLink]);

  const handleSelectPlan = useCallback(
    async (plan: 'monthly' | 'annual') => {
      setError(null);
      setStep('waiting-payment');
      const result = await openSubscribe({ plan });
      if (!result.success) {
        setError(result.error || 'Failed to open checkout');
        setStep('pricing');
      }
    },
    [openSubscribe]
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Where "Enable Sync" on value-prop should go
  // Always go to email first — checkout requires authentication
  const handleEnableSync = useCallback(() => {
    setStep('email');
  }, []);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-modal-title"
        className={styles.modal}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className={styles.content}>
          {/* Step: Value Proposition */}
          {step === 'value-prop' && (
            <>
              <div className={styles.iconWrapper}>
                <Cloud size={36} />
              </div>
              <h2 id="sync-modal-title" className={styles.title}>
                Sync across devices
              </h2>
              <p className={styles.subtitle}>
                Your notes stay on your machine. Enable sync to access them from any device, with
                end-to-end encryption.
              </p>
              <ul className={styles.benefits}>
                <li>Access notes on all your devices</li>
                <li>End-to-end encrypted — only you can read them</li>
                <li>Works offline, syncs when connected</li>
                <li>No account required to use Dripnex locally</li>
              </ul>
              <button type="button" className={styles.button} onClick={handleEnableSync}>
                Get Started
              </button>
            </>
          )}

          {/* Step: Pricing */}
          {step === 'pricing' && (
            <>
              <div className={styles.iconWrapper}>
                <Sparkles size={36} />
              </div>
              <h2 id="sync-modal-title" className={styles.title}>
                Upgrade to Pro
              </h2>
              <p className={styles.subtitle}>
                {licenseState?.trial && !licenseState.trial.isExpired
                  ? config.trialDescription
                  : 'Get cloud sync and all Pro features'}
              </p>
              <div className={styles.planButtons}>
                <button
                  type="button"
                  className={styles.planButtonRecommended}
                  onClick={() => handleSelectPlan('annual')}
                >
                  <span className={styles.planLabel}>
                    Annual — {proPricing.intervals.annual.label}
                  </span>
                  {proPricing.annualSavings && (
                    <span className={styles.savingsBadge}>Save {proPricing.annualSavings}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={styles.planButton}
                  onClick={() => handleSelectPlan('monthly')}
                >
                  <span className={styles.planLabel}>
                    Monthly — {proPricing.intervals.monthly.label}
                  </span>
                </button>
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  setError(null);
                  setStep('value-prop');
                }}
              >
                Back
              </button>
            </>
          )}

          {/* Step: Waiting for Payment */}
          {step === 'waiting-payment' && (
            <div className={styles.checking}>
              <div className={styles.spinner} />
              <p>Complete checkout in your browser...</p>
              <p className={styles.waitingHint}>This window will update automatically</p>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => setStep('pricing')}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Step: Email Input */}
          {step === 'email' && (
            <>
              <div className={styles.iconWrapper}>
                <Mail size={36} />
              </div>
              <h2 className={styles.title}>Sign in or create account</h2>
              <p className={styles.subtitle}>
                Enter your email and we'll send you a sign-in link. No password needed — if you're
                new, your account is created automatically.
              </p>
              <form onSubmit={handleSubmitEmail} className={styles.form}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={styles.input}
                  aria-label="Email address"
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
                {error && <p className={styles.error}>{error}</p>}
                <button type="submit" className={styles.button}>
                  Continue with Email
                </button>
              </form>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => setStep('value-prop')}
              >
                Back
              </button>
            </>
          )}

          {/* Step: Sending */}
          {step === 'checking' && (
            <div className={styles.checking}>
              <div className={styles.spinner} />
              <p>Sending magic link...</p>
            </div>
          )}

          {/* Step: Email Sent — Waiting for Verification */}
          {step === 'sent' && (
            <div className={styles.sent}>
              <CheckCircle size={48} className={styles.checkIcon} />
              <h3>Check your email</h3>
              <p>
                We sent a magic link to <strong>{email}</strong>
              </p>
              <p className={styles.hint}>
                Click the link in the email to sign in. This window will update automatically.
              </p>

              {error && <p className={styles.error}>{error}</p>}

              <div className={styles.resendRow}>
                {resendTimer > 0 ? (
                  <span className={styles.resendTimer}>Resend in {resendTimer}s</span>
                ) : (
                  <button type="button" className={styles.linkButton} onClick={handleResend}>
                    <RefreshCw size={12} />
                    Resend magic link
                  </button>
                )}
              </div>

              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  setStep('email');
                  setError(null);
                }}
              >
                Use a different email
              </button>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className={styles.sent}>
              <CheckCircle size={48} className={styles.successIcon} />
              <h3>You're syncing!</h3>
              <p>Your notes will now sync across all your devices.</p>
              <button type="button" className={styles.button} onClick={handleClose}>
                Done
              </button>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <p>
            By signing in, you agree to our{' '}
            <a href="https://dripnex.app/terms" target="_blank" rel="noopener">
              Terms
            </a>{' '}
            and{' '}
            <a href="https://dripnex.app/privacy" target="_blank" rel="noopener">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
