import { useState } from 'react';
import { LayoutZone, useThemeOverrides } from '@dripnex/plugin-api';
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings';
import { usePerformanceMode } from '../../hooks/usePerformanceMode';
import { useOfficialThemes } from '../../hooks/useOfficialThemes';
import { Toaster } from '../../ui/primitives';
import styles from './SettingsApp.module.css';
import { SettingsSidebar } from './components/SettingsSidebar';
import { GeneralSection } from './sections/GeneralSection';
import { EditorSection } from './sections/EditorSection';
import { ThemesSection } from './sections/ThemesSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { AiSection } from './sections/AiSection';
import { KeybindingsSection } from './sections/KeybindingsSection';
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
  | 'themes'
  | 'appearance'
  | 'ai'
  | 'keybindings'
  | 'plugins'
  | 'plugins-install'
  | 'plugins-updates'
  | 'account'
  | 'encryption'
  | 'integrations'
  | 'backup'
  | 'updates'
  | 'about';

export function SettingsApp() {
  usePerformanceMode();
  useOfficialThemes();
  useThemeOverrides();
  useAppearanceSettings();
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  const renderSection = () => {
    switch (activeSection) {
      case 'general':
        return <GeneralSection />;
      case 'editor':
        return <EditorSection />;
      case 'themes':
        return <ThemesSection />;
      case 'appearance':
        return <AppearanceSection />;
      case 'ai':
        return <AiSection />;
      case 'keybindings':
        return <KeybindingsSection />;
      case 'plugins':
        return <PluginsSection pane="installed" />;
      case 'plugins-install':
        return <PluginsSection pane="install" />;
      case 'plugins-updates':
        return <PluginsSection pane="updates" />;
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
      <main className={styles.content}>
        {renderSection()}
        <LayoutZone name="settings-section" />
      </main>
      <Toaster />
    </div>
  );
}
