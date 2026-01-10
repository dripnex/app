import { Settings, FileText, Palette, User, Database, Info } from 'lucide-react';
import type { SettingsSection } from '../SettingsApp';
import styles from './SettingsSidebar.module.css';

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

const sections: { id: SettingsSection; label: string; Icon: any }[] = [
  { id: 'general', label: 'General', Icon: Settings },
  { id: 'editor', label: 'Editor', Icon: FileText },
  { id: 'appearance', label: 'Appearance', Icon: Palette },
  { id: 'account', label: 'Account', Icon: User },
  { id: 'backup', label: 'Backup & Data', Icon: Database },
  { id: 'about', label: 'About', Icon: Info },
];

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
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
    </aside>
  );
}
