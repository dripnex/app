/**
 * Magic Link Authentication Flow
 *
 * Multi-step dialog for passwordless authentication via email magic link.
 */

import { useState, useCallback, FormEvent } from 'react';
import { Mail, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import styles from './MagicLinkFlow.module.css';

export interface MagicLinkFlowProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = 'email' | 'sent' | 'verifying' | 'success' | 'error';

export function MagicLinkFlow({ onSuccess: _onSuccess, onCancel }: MagicLinkFlowProps) {
  const { requestMagicLink, error: authError } = useAuthStore();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmitEmail = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      try {
        await requestMagicLink(email);
        setStep('sent');
      } catch (_err) {
        // Error message is already set in authStore with improved messaging
        setStep('error');
      } finally {
        setIsLoading(false);
      }
    },
    [email, requestMagicLink]
  );

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleRetry = useCallback(() => {
    setStep('email');
    setError(null);
  }, []);

  return (
    <div className={styles.overlay} onClick={handleCancel}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <button type="button" className={styles.closeButton} onClick={handleCancel}>
          <X size={20} />
        </button>

        <div className={styles.content}>
          {/* Step 1: Enter Email */}
          {step === 'email' && (
            <>
              <div className={styles.header}>
                <Mail size={32} className={styles.icon} />
                <h2 className={styles.title}>Sign in to Readied</h2>
                <p className={styles.description}>
                  Enter your email to receive a magic link for secure, passwordless sign-in.
                </p>
              </div>

              <form onSubmit={handleSubmitEmail} className={styles.form}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className={styles.input}
                  autoFocus
                  required
                />

                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isLoading || !email}
                >
                  {isLoading ? 'Sending...' : 'Send Magic Link'}
                </button>
              </form>
            </>
          )}

          {/* Step 2: Email Sent */}
          {step === 'sent' && (
            <>
              <div className={styles.header}>
                <CheckCircle size={32} className={styles.successIcon} />
                <h2 className={styles.title}>Check your email</h2>
                <p className={styles.description}>
                  We sent a magic link to <strong>{email}</strong>. Click the link in the email to
                  sign in.
                </p>
              </div>

              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} onClick={handleRetry}>
                  Use different email
                </button>
              </div>
            </>
          )}

          {/* Step 3: Verifying */}
          {step === 'verifying' && (
            <>
              <div className={styles.header}>
                <div className={styles.spinner} />
                <h2 className={styles.title}>Verifying...</h2>
                <p className={styles.description}>Please wait while we verify your magic link.</p>
              </div>
            </>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <>
              <div className={styles.header}>
                <CheckCircle size={32} className={styles.successIcon} />
                <h2 className={styles.title}>Welcome back!</h2>
                <p className={styles.description}>You've successfully signed in.</p>
              </div>
            </>
          )}

          {/* Step 5: Error */}
          {step === 'error' && (
            <>
              <div className={styles.header}>
                <AlertCircle size={32} className={styles.errorIcon} />
                <h2 className={styles.title}>Sign in failed</h2>
                <p className={styles.description}>{error || authError || 'Something went wrong'}</p>
              </div>

              <div className={styles.actions}>
                <button type="button" className={styles.primaryButton} onClick={handleRetry}>
                  Try again
                </button>
                <button type="button" className={styles.secondaryButton} onClick={handleCancel}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
