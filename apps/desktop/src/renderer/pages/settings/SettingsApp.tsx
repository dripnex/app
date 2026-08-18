import { useState } from 'react';
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings';
import { useOfficialThemes } from '../../hooks/useOfficialThemes';
import { useThemeOverrides } from '@dripnex/plugin-api';
import { Toaster } from '../../ui/primitives';
import styles from './SettingsApp.module.css';
import { SettingsSidebar } from './components/SettingsSidebar';
import { GeneralSection } from './sections/GeneralSection';
import { EditorSection } from './sections/EditorSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { AiSection } from './sections/AiSection';
import { AccountSection } from './sections/AccountSection';
import { BackupSection } from './sections/BackupSection';
import { AboutSection } from './sections/AboutSection';
import { UpdatesSection } from './sections/UpdatesSection';
import { PluginsSection } from './sections/PluginsSection';
import { EncryptionSection } from './sections/EncryptionSection';
import { IntegrationsSection } from './sections/IntegrationsSection';

export type SettingsSection =
  | 'general'
  | 'editor'
  | 'appearance'
  | 'ai'
  | 'plugins'
  | 'account'
  | 'encryption'
  | 'integrations'
  | 'backup'
  | 'updates'
  | 'about';

export function SettingsApp() {
  useAppearanceSettings();
  useOfficialThemes();
  useThemeOverrides();
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  const renderSection = () => {
    switch (activeSection) {
      case 'general':
        return <GeneralSection />;
      case 'editor':
        return <EditorSection />;
      case 'appearance':
        return <AppearanceSection />;
      case 'ai':
        return <AiSection />;
      case 'plugins':
        return <PluginsSection />;
      case 'account':
        return <AccountSection />;
      case 'encryption':
        return <EncryptionSection />;
      case 'integrations':
        return <IntegrationsSection onOpenEncryption={() => setActiveSection('encryption')} />;
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
      <Toaster />
    </div>
  );
}
