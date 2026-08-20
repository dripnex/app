import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide';
import { Icon } from '../../../ui/icons/Icon';
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
        <Icon icon={open ? ChevronDown : ChevronRight} size={14} />
        <span>{label}</span>
      </button>
      {open ? <div className={styles.body}>{children}</div> : null}
    </div>
  );
}
