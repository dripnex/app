import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuthStore, selectError } from '../../stores/authStore';
import { LoginBackdrop } from './LoginBackdrop';
import styles from './AuthGate.module.css';
import logo from '../../assets/logo.png';

/**
 * Full-window sign-in. Account is required even on the free plan
 * so every install maps to a user.
 */
export function AuthGate({ hydrating = false }: { hydrating?: boolean }) {
  const requestMagicLink = useAuthStore(state => state.requestMagicLink);
  const continueLocally = useAuthStore(state => state.continueLocally);
  const authError = useAuthStore(selectError);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [offerLocal, setOfferLocal] = useState(false);
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
        setOfferLocal(false);
      } catch {
        setSent(false);
        setOfferLocal(true);
      } finally {
        setPending(false);
      }
    },
    [email, requestMagicLink]
  );

  const goLocal = useCallback(async () => {
    setLocalError(null);
    setPending(true);
    try {
      await continueLocally(email.trim());
    } catch {
      setOfferLocal(true);
    } finally {
      setPending(false);
    }
  }, [email, continueLocally]);

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
                ? 'Free to start. We’ll email you a link — no password.'
                : 'We’ll email you a one-time link. Leave this window open.'}
            </p>

            {sent ? (
              <p className={styles.sent}>
                Check <strong>{email}</strong> for a {mode === 'signup' ? 'sign-up' : 'sign-in'}{' '}
                link.
              </p>
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
                {offerLocal ? (
                  <button
                    className={styles.local}
                    type="button"
                    disabled={pending || !email.trim()}
                    onClick={() => void goLocal()}
                  >
                    Continue locally
                  </button>
                ) : null}
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
