/**
 * Enable Sync Modal
 *
 * Guides the user through enabling cloud sync with magic link auth.
 * Shows value proposition → email input → waiting for link → success.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Cloud, Mail, CheckCircle, X, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import styles from './LoginModal.module.css';

interface EnableSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'value-prop' | 'email' | 'checking' | 'sent' | 'success';

const RESEND_COOLDOWN = 60; // seconds

export function EnableSyncModal({ isOpen, onClose }: EnableSyncModalProps) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('value-prop');
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { requestMagicLink, isAuthenticated } = useAuthStore();

  // Watch for auth success (deep link verified in background)
  useEffect(() => {
    if (isAuthenticated && (step === 'sent' || step === 'checking')) {
      setStep('success');
    }
  }, [isAuthenticated, step]);

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

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Delay reset so close animation can play
      const timeout = setTimeout(() => {
        setStep('value-prop');
        setEmail('');
        setError(null);
        setResendTimer(0);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

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
    if (resendTimer > 0) return;
    setError(null);

    try {
      await requestMagicLink(email);
      setResendTimer(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend');
    }
  }, [email, resendTimer, requestMagicLink]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className={styles.content}>
          {/* Step 1: Value Proposition */}
          {step === 'value-prop' && (
            <>
              <div className={styles.iconWrapper}>
                <Cloud size={36} />
              </div>
              <h2 className={styles.title}>Sync across devices</h2>
              <p className={styles.subtitle}>
                Your notes stay on your machine. Enable sync to access them from any device, with
                end-to-end encryption.
              </p>
              <ul className={styles.benefits}>
                <li>Access notes on all your devices</li>
                <li>End-to-end encrypted — only you can read them</li>
                <li>Works offline, syncs when connected</li>
                <li>No account required to use Readied locally</li>
              </ul>
              <button type="button" className={styles.button} onClick={() => setStep('email')}>
                Enable Sync
              </button>
            </>
          )}

          {/* Step 2: Email Input */}
          {step === 'email' && (
            <>
              <div className={styles.iconWrapper}>
                <Mail size={36} />
              </div>
              <h2 className={styles.title}>Enter your email</h2>
              <p className={styles.subtitle}>We'll send a magic link — no password needed.</p>
              <form onSubmit={handleSubmitEmail} className={styles.form}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={styles.input}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
                {error && <p className={styles.error}>{error}</p>}
                <button type="submit" className={styles.button}>
                  Send Magic Link
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

          {/* Step 3: Sending */}
          {step === 'checking' && (
            <div className={styles.checking}>
              <div className={styles.spinner} />
              <p>Sending magic link...</p>
            </div>
          )}

          {/* Step 4: Email Sent — Waiting for Verification */}
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

          {/* Step 5: Success */}
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
            <a href="https://readied.app/terms" target="_blank" rel="noopener">
              Terms
            </a>{' '}
            and{' '}
            <a href="https://readied.app/privacy" target="_blank" rel="noopener">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
