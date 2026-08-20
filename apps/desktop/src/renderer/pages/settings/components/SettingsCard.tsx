import type { ReactNode } from 'react';
import styles from './SettingsCard.module.css';

export type SettingsCardTone = 'ok' | 'warn' | 'idle' | 'muted';

interface SettingsCardProps {
  children: ReactNode;
  tone?: SettingsCardTone;
  active?: boolean;
  flush?: boolean;
  onClick?: () => void;
}

export function SettingsCard({ children, tone, active, flush, onClick }: SettingsCardProps) {
  return (
    <article
      className={[styles.card, flush ? styles.flush : '', onClick ? styles.clickable : '']
        .filter(Boolean)
        .join(' ')}
      data-tone={tone}
      data-active={active ? 'true' : undefined}
      onClick={onClick}
    >
      {children}
    </article>
  );
}
