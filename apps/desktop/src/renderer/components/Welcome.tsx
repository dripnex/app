/**
 * Welcome — First-run onboarding screen
 *
 * Shown once on first launch. Offers to create the user's first note
 * or skip straight into the app.
 */

import { Button } from '../ui/primitives';
import styles from './Welcome.module.css';

interface WelcomeProps {
  /** Called when user finishes onboarding. `createNote` is true when they click the CTA. */
  onComplete: (createNote: boolean) => void;
}

const features = [
  {
    title: 'Offline Forever',
    desc: 'Your notes never leave your machine.',
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
  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <span className={styles.brand}>Readied</span>

        <h1 className={styles.headline}>Your Markdown. Your Machine. Your&nbsp;Rules.</h1>

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
          <button type="button" className={styles.skip} onClick={() => onComplete(false)}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
