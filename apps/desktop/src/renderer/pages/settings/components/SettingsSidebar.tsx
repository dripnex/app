import {
  Settings,
  FileText,
  Palette,
  Sparkles,
  User,
  KeyRound,
  Database,
  Info,
  Download,
  Puzzle,
  RotateCcw,
  Blocks,
} from 'lucide';
import { Icon } from '../../../ui/icons/Icon';
import { toast } from '../../../ui/primitives';
import { useSettingsStore } from '../../../stores/settings';
import type { SettingsSection } from '../SettingsApp';
import styles from './SettingsSidebar.module.css';

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

const sections: { id: SettingsSection; label: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'editor', label: 'Editor', icon: FileText },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
  { id: 'account', label: 'Account', icon: User },
  { id: 'encryption', label: 'Encryption', icon: KeyRound },
  { id: 'integrations', label: 'Integrations', icon: Blocks },
  { id: 'backup', label: 'Backup & Data', icon: Database },
  { id: 'updates', label: 'Updates', icon: Download },
  { id: 'about', label: 'About', icon: Info },
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
      <div className={styles.header} aria-hidden="true" />
      <nav className={styles.nav}>
        {sections.map(section => (
          <button
            key={section.id}
            className={`${styles.navItem} ${activeSection === section.id ? styles.active : ''}`}
            onClick={() => onSectionChange(section.id)}
          >
            <Icon icon={section.icon} size={16} className={styles.icon} />
            <span className={styles.label}>{section.label}</span>
          </button>
        ))}
      </nav>
      <div className={styles.footer}>
        <button className={styles.resetButton} onClick={handleResetAll}>
          <Icon icon={RotateCcw} size={16} className={styles.icon} />
          <span>Reset to Defaults</span>
        </button>
      </div>
    </aside>
  );
}
