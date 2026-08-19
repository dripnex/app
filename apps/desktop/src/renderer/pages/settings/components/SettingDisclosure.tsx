import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import styles from './SettingDisclosure.module.css';

interface SettingDisclosureProps {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function SettingDisclosure({ label, open, onToggle, children }: SettingDisclosureProps) {
  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.toggle} onClick={onToggle} aria-expanded={open}>
        {open ? (
          <ChevronDown size={14} aria-hidden="true" />
        ) : (
          <ChevronRight size={14} aria-hidden="true" />
        )}
        <span>{label}</span>
      </button>
      {open ? <div className={styles.body}>{children}</div> : null}
    </div>
  );
}
