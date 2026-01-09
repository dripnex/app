/**
 * SettingGroup Component
 *
 * Groups related settings together with an optional title.
 */

import type { ReactNode } from 'react';
import styles from './SettingGroup.module.css';

export interface SettingGroupProps {
  title?: string;
  children: ReactNode;
}

export function SettingGroup({ title, children }: SettingGroupProps) {
  return (
    <div className={styles.group}>
      {title && <h3 className={styles.groupTitle}>{title}</h3>}
      <div className={styles.groupContent}>{children}</div>
    </div>
  );
}
