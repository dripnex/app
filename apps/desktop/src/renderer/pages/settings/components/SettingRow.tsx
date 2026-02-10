/**
 * SettingRow Component
 *
 * A single row in the settings UI with label, description, and control.
 */

import { ReactNode } from 'react';
import styles from './SettingRow.module.css';

interface SettingRowProps {
  /** Setting label (main text) */
  label: string;
  /** Optional description (smaller text below label) */
  description?: string;
  /** The control element (Toggle, Select, NumberInput, etc.) */
  children: ReactNode;
  /** HTML id for accessibility (links label to control) */
  htmlFor?: string;
}

export function SettingRow({ label, description, children, htmlFor }: SettingRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.labelContainer}>
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
        </label>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      <div className={styles.control}>{children}</div>
    </div>
  );
}
