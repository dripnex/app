import type { ReactNode } from 'react';
import styles from './SettingsPage.module.css';

interface SettingsPageProps {
  title: string;
  lede?: ReactNode;
  children: ReactNode;
}

export function SettingsPage({ title, lede, children }: SettingsPageProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {lede ? <p className={styles.lede}>{lede}</p> : null}
      </header>
      {children}
    </div>
  );
}
