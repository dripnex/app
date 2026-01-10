/**
 * SettingRow Component
 *
 * A row for a single setting with label, description, and control.
 */

import type { ReactNode } from 'react';
import styles from './SettingRow.module.css';

export interface SettingRowProps {
  label: string;
  description?: string;
  children: ReactNode;
  htmlFor?: string;
}

export function SettingRow({ label, description, children, htmlFor }: SettingRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.info}>
        <label htmlFor={htmlFor} className={styles.label}>
          {label}
        </label>
        {description && <div className={styles.description}>{description}</div>}
      </div>
      <div className={styles.control}>{children}</div>
    </div>
  );
}
