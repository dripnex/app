import { useState } from 'react';
import styles from './SettingsApp.module.css';
import { SettingsSidebar } from './components/SettingsSidebar';
import { GeneralSection } from './sections/GeneralSection';
import { EditorSection } from './sections/EditorSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { AboutSection } from './sections/AboutSection';

export type SettingsSection = 'general' | 'editor' | 'appearance' | 'about';

export function SettingsApp() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  const renderSection = () => {
    switch (activeSection) {
      case 'general':
        return <GeneralSection />;
      case 'editor':
        return <EditorSection />;
      case 'appearance':
        return <AppearanceSection />;
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
