import {
  Settings,
  FileText,
  Palette,
  Sparkles,
  User,
  Database,
  Info,
  Download,
  Puzzle,
  RotateCcw,
} from 'lucide-react';
import { toast } from '../../../ui/primitives';
import { useSettingsStore } from '../../../stores/settings';
import type { SettingsSection } from '../SettingsApp';
import styles from './SettingsSidebar.module.css';

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sections: { id: SettingsSection; label: string; Icon: any }[] = [
  { id: 'general', label: 'General', Icon: Settings },
  { id: 'editor', label: 'Editor', Icon: FileText },
  { id: 'appearance', label: 'Appearance', Icon: Palette },
  { id: 'ai', label: 'AI Assistant', Icon: Sparkles },
  { id: 'plugins', label: 'Plugins', Icon: Puzzle },
  { id: 'account', label: 'Account', Icon: User },
  { id: 'backup', label: 'Backup & Data', Icon: Database },
  { id: 'updates', label: 'Updates', Icon: Download },
  { id: 'about', label: 'About', Icon: Info },
];

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  const handleResetAll = () => {
    const confirmed = window.confirm(
      'Reset all settings to their default values? This cannot be undone.'
    );
    if (!confirmed) return;
    useSettingsStore.getState().resetAll();
    toast.info('Settings reset to defaults');
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
      </div>
      <nav className={styles.nav}>
        {sections.map(section => {
          const { Icon } = section;
          return (
            <button
              key={section.id}
              className={`${styles.navItem} ${activeSection === section.id ? styles.active : ''}`}
              onClick={() => onSectionChange(section.id)}
            >
              <Icon size={16} className={styles.icon} />
              <span className={styles.label}>{section.label}</span>
            </button>
          );
        })}
      </nav>
      <div className={styles.footer}>
        <div className={styles.separator} />
        <button className={styles.resetButton} onClick={handleResetAll}>
          <RotateCcw size={14} className={styles.icon} />
          <span>Reset to Defaults</span>
        </button>
      </div>
    </aside>
  );
}
