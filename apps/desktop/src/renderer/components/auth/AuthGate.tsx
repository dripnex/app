import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuthStore, selectError } from '../../stores/authStore';
import logo from '../../assets/logo.png';
import { LoginBackdrop } from './LoginBackdrop';
import styles from './AuthGate.module.css';

/**
 * Full-window sign-in. AuthGate is the first window.
 * Account is required. There is no guest path and no continue-locally skip.
 */
export function AuthGate({ hydrating = false }: { hydrating?: boolean }) {
  const requestMagicLink = useAuthStore(state => state.requestMagicLink);
  const authError = useAuthStore(selectError);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    if (authError) setLocalError(authError);
  }, [authError]);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setLocalError(null);
      setPending(true);
      try {
        await requestMagicLink(email.trim());
        setSent(true);
      } catch {
        setSent(false);
      } finally {
        setPending(false);
      }
    },
    [email, requestMagicLink]
  );

  return (
    <div className={styles.screen}>
      <LoginBackdrop />
      <div className={styles.card}>
        <img src={logo} alt="" width={40} height={40} className={styles.logo} />
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={mode === 'signin' ? styles.tabActive : styles.tab}
            onClick={() => setMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? styles.tabActive : styles.tab}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
        </div>
        <h1 className={styles.title}>
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        {hydrating ? (
          <p className={styles.copy}>Opening your workspace…</p>
        ) : (
          <>
            <p className={styles.copy}>
              {mode === 'signup'
                ? 'The hackable AI note taker. We’ll email you a link. No password.'
                : 'The hackable AI note taker. We’ll email you a one-time link. Leave this window open.'}
            </p>

            {sent ? (
              <>
                <p className={styles.sent}>
                  Check <strong>{email}</strong> for a {mode === 'signup' ? 'sign-up' : 'sign-in'}{' '}
                  link.
                </p>
                {localError ? <p className={styles.error}>{localError}</p> : null}
                {localError ? (
                  <button
                    className={styles.local}
                    type="button"
                    onClick={() => {
                      setSent(false);
                      setLocalError(null);
                    }}
                  >
                    Request a new link
                  </button>
                ) : null}
              </>
            ) : (
              <form className={styles.form} onSubmit={e => void submit(e)}>
                <label className={styles.label} htmlFor="auth-email">
                  Email
                </label>
                <input
                  id="auth-email"
                  className={styles.input}
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
                {localError ? <p className={styles.error}>{localError}</p> : null}
                <button className={styles.submit} type="submit" disabled={pending}>
                  {pending ? 'Sending…' : mode === 'signup' ? 'Create account' : 'Email me a link'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
