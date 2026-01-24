/**
 * SettingGroup Component
 *
 * Groups related settings with a header.
 */

import { ReactNode } from 'react';
import styles from './SettingGroup.module.css';

interface SettingGroupProps {
  /** Group title */
  title: string;
  /** Setting rows */
  children: ReactNode;
}

export function SettingGroup({ title, children }: SettingGroupProps) {
  return (
    <div className={styles.group}>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
