/**
 * Login Modal
 *
 * Simple modal for email login with magic link.
 */

import { useState } from 'react';
import { useSyncStore } from '../../stores/syncStore';
import styles from './LoginModal.module.css';

export function LoginModal() {
  const { showLoginModal, closeLoginModal } = useSyncStore();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'checking' | 'sent'>('email');
  const [error, setError] = useState<string | null>(null);

  if (!showLoginModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStep('checking');

    try {
      // Call IPC to request magic link
      await window.readied.sync?.requestMagicLink(email);
      setStep('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
      setStep('email');
    }
  };

  const handleClose = () => {
    setStep('email');
    setEmail('');
    setError(null);
    closeLoginModal();
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={handleClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="currentColor"
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>

        <div className={styles.content}>
          <h2 className={styles.title}>Sign in to sync</h2>
          <p className={styles.subtitle}>Sync your notes across devices with Readied Pro.</p>

          {step === 'email' && (
            <form onSubmit={handleSubmit} className={styles.form}>
              <label className={styles.label}>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={styles.input}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </label>

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.button}>
                Continue with email
              </button>
            </form>
          )}

          {step === 'checking' && (
            <div className={styles.checking}>
              <div className={styles.spinner} />
              <p>Sending magic link...</p>
            </div>
          )}

          {step === 'sent' && (
            <div className={styles.sent}>
              <svg viewBox="0 0 24 24" className={styles.checkIcon}>
                <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              <h3>Check your email</h3>
              <p>
                We sent a magic link to <strong>{email}</strong>
              </p>
              <p className={styles.hint}>Click the link in the email to sign in.</p>
              <button onClick={() => setStep('email')} className={styles.linkButton}>
                Use a different email
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
