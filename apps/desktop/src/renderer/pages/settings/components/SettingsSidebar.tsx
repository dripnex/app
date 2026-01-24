import type { SettingsSection } from '../SettingsApp';
import styles from './SettingsSidebar.module.css';

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

const sections: { id: SettingsSection; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: 'cog' },
  { id: 'editor', label: 'Editor', icon: 'edit' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'backup', label: 'Backup', icon: 'archive' },
  { id: 'updates', label: 'Updates', icon: 'download' },
  { id: 'about', label: 'About', icon: 'info' },
];

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
      </div>
      <nav className={styles.nav}>
        {sections.map(section => (
          <button
            key={section.id}
            className={`${styles.navItem} ${activeSection === section.id ? styles.active : ''}`}
            onClick={() => onSectionChange(section.id)}
          >
            <span className={styles.label}>{section.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
