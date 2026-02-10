import { useState } from 'react';
import styles from './SettingsApp.module.css';
import { SettingsSidebar } from './components/SettingsSidebar';
import { GeneralSection } from './sections/GeneralSection';
import { EditorSection } from './sections/EditorSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { AccountSection } from './sections/AccountSection';
import { BackupSection } from './sections/BackupSection';
import { AboutSection } from './sections/AboutSection';
import { UpdatesSection } from './sections/UpdatesSection';
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings';

export type SettingsSection =
  | 'general'
  | 'editor'
  | 'appearance'
  | 'account'
  | 'backup'
  | 'updates'
  | 'about';

export function SettingsApp() {
  useAppearanceSettings();
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  const renderSection = () => {
    switch (activeSection) {
      case 'general':
        return <GeneralSection />;
      case 'editor':
        return <EditorSection />;
      case 'appearance':
        return <AppearanceSection />;
      case 'account':
        return <AccountSection />;
      case 'backup':
        return <BackupSection />;
      case 'updates':
        return <UpdatesSection />;
      case 'about':
        return <AboutSection />;
      default:
        return <GeneralSection />;
    }
  };

  return (
    <div className={styles.container}>
      <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <main className={styles.content}>{renderSection()}</main>
    </div>
  );
}
