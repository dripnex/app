/**
 * Welcome — First-run onboarding screen
 *
 * Shown once on first launch. Offers to create the user's first note
 * or skip straight into the app.
 */

import { useCallback, useEffect } from 'react';
import { Button } from '../ui/primitives';
import styles from './Welcome.module.css';

interface WelcomeProps {
  /** Called when user finishes onboarding. `createNote` is true when they click the CTA. */
  onComplete: (createNote: boolean) => void;
}

const features = [
  {
    title: 'Local-First',
    desc: 'Works fully offline. Optional end-to-end encrypted sync.',
  },
  {
    title: 'Pure Markdown',
    desc: 'Standard .md under the hood. No lock-in.',
  },
  {
    title: 'Extensible',
    desc: 'Plugins, themes, and AI built in.',
  },
] as const;

export function Welcome({ onComplete }: WelcomeProps) {
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
        <span className={styles.brand}>Readied</span>

        <h1 id="welcome-heading" className={styles.headline}>
          Your Markdown. Your Machine. Your&nbsp;Rules.
        </h1>

        <div className={styles.cards}>
          {features.map(f => (
            <div key={f.title} className={styles.card}>
              <p className={styles.cardTitle}>{f.title}</p>
              <p className={styles.cardDesc}>{f.desc}</p>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <Button variant="primary" onClick={() => onComplete(true)}>
            Create Your First Note
          </Button>
          <Button variant="ghost" onClick={() => onComplete(false)}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}
