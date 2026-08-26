/**
 * Welcome — First-run onboarding after AuthGate.
 *
 * Shown once on first launch. Offers to create the user's first note
 * or skip straight into the app. Never a guest path around the account.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Button } from '../ui/primitives';
import logo from '../assets/logo.png';
import styles from './Welcome.module.css';
import { WELCOME_FEATURES, WELCOME_HEADLINE, WELCOME_LEDE } from './welcomeCopy';

export { WELCOME_FEATURES, WELCOME_HEADLINE, WELCOME_LEDE } from './welcomeCopy';

interface WelcomeProps {
  /** Called when user finishes onboarding. `createNote` is true when they click the CTA. */
  onComplete: (createNote: boolean) => void;
}

export function Welcome({ onComplete }: WelcomeProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onComplete(false);
      }
    },
    [onComplete]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-heading"
    >
      <div className={styles.container}>
        <div className={styles.brandRow}>
          <img src={logo} alt="" className={styles.logo} width={72} height={72} />
          <span className={styles.brand}>Dripnex</span>
        </div>

        <h1 id="welcome-heading" className={styles.headline}>
          {WELCOME_HEADLINE}
        </h1>

        <p className={styles.lede}>{WELCOME_LEDE}</p>

        <div className={styles.cards}>
          {WELCOME_FEATURES.map(f => (
            <div key={f.title} className={styles.card}>
              <p className={styles.cardTitle}>{f.title}</p>
              <p className={styles.cardDesc}>{f.desc}</p>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <Button ref={primaryRef} variant="primary" onClick={() => onComplete(true)}>
            Create Your First Note
          </Button>
          <Button variant="ghost" onClick={() => onComplete(false)}>
            I'll explore on my own
          </Button>
        </div>

        <p className={styles.hint}>
          Pro tip: Press <kbd className={styles.kbd}>Cmd+K</kbd> to open the command palette
        </p>
      </div>
    </div>
  );
}
