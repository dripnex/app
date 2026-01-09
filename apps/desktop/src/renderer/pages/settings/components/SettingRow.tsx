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
}

export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.info}>
        <div className={styles.label}>{label}</div>
        {description && <div className={styles.description}>{description}</div>}
      </div>
      <div className={styles.control}>{children}</div>
    </div>
  );
}
