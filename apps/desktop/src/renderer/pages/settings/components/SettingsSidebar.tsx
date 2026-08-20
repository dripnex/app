import { useEffect, useState } from 'react';
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
  Keyboard,
  Paintbrush,
} from 'lucide';
import { Icon } from '../../../ui/icons/Icon';
import { Button, toast } from '../../../ui/primitives';
import { useSettingsStore } from '../../../stores/settings';
import { versionNewer } from '../sections/plugins/version';
import type { SettingsSection } from '../SettingsApp';
import styles from './SettingsSidebar.module.css';

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

function usePluginUpdateCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [scanned, registry] = await Promise.all([
          window.dripnex.plugins.scan(),
          window.dripnex.plugins.listRegistry(),
        ]);
        const bySlug = new Map(registry.plugins.map(p => [p.slug, p.version]));
        let n = 0;
        for (const plugin of scanned) {
          const latest = bySlug.get(plugin.id);
          if (latest && versionNewer(latest, plugin.version)) n += 1;
        }
        if (!cancelled) setCount(n);
      } catch {
        if (!cancelled) setCount(0);
      }
    }
    void load();
    const onRefresh = () => void load();
    window.addEventListener('dripnex:plugins:refresh', onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('dripnex:plugins:refresh', onRefresh);
    };
  }, []);

  return count;
}

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  const pluginUpdates = usePluginUpdateCount();

  const handleResetAll = () => {
    const confirmed = window.confirm(
      'Reset all settings to their default values? This cannot be undone.'
    );
    if (!confirmed) return;
    useSettingsStore.getState().resetAll();
    toast.info('Settings reset to defaults');
  };

  const pluginsActive =
    activeSection === 'plugins' ||
    activeSection === 'plugins-install' ||
    activeSection === 'plugins-updates';

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header} aria-hidden="true" />
      <nav className={styles.nav}>
        <NavButton
          id="general"
          label="General"
          icon={Settings}
          active={activeSection === 'general'}
          onClick={onSectionChange}
        />
        <NavButton
          id="editor"
          label="Editor"
          icon={FileText}
          active={activeSection === 'editor'}
          onClick={onSectionChange}
        />
        <NavButton
          id="themes"
          label="Themes"
          icon={Paintbrush}
          active={activeSection === 'themes'}
          onClick={onSectionChange}
        />
        <NavButton
          id="appearance"
          label="Appearance"
          icon={Palette}
          active={activeSection === 'appearance'}
          onClick={onSectionChange}
        />
        <NavButton
          id="ai"
          label="AI Assistant"
          icon={Sparkles}
          active={activeSection === 'ai'}
          onClick={onSectionChange}
        />
        <NavButton
          id="keybindings"
          label="Keybindings"
          icon={Keyboard}
          active={activeSection === 'keybindings'}
          onClick={onSectionChange}
        />

        <div className={styles.group}>
          <NavButton
            id="plugins"
            label="Plugins"
            icon={Puzzle}
            active={pluginsActive && activeSection === 'plugins'}
            onClick={onSectionChange}
          />
          <button
            type="button"
            className={`${styles.childItem} ${activeSection === 'plugins-install' ? styles.active : ''}`}
            onClick={() => onSectionChange('plugins-install')}
          >
            <span className={styles.label}>Install</span>
          </button>
          <button
            type="button"
            className={`${styles.childItem} ${activeSection === 'plugins-updates' ? styles.active : ''}`}
            onClick={() => onSectionChange('plugins-updates')}
          >
            <span className={styles.label}>Updates</span>
            {pluginUpdates > 0 ? <span className={styles.badge}>{pluginUpdates}</span> : null}
          </button>
        </div>

        <NavButton
          id="account"
          label="Account"
          icon={User}
          active={activeSection === 'account'}
          onClick={onSectionChange}
        />
        <NavButton
          id="encryption"
          label="Encryption"
          icon={KeyRound}
          active={activeSection === 'encryption'}
          onClick={onSectionChange}
        />
        <NavButton
          id="integrations"
          label="Integrations"
          icon={Blocks}
          active={activeSection === 'integrations'}
          onClick={onSectionChange}
        />
        <NavButton
          id="backup"
          label="Backup & Data"
          icon={Database}
          active={activeSection === 'backup'}
          onClick={onSectionChange}
        />
        <NavButton
          id="updates"
          label="Updates"
          icon={Download}
          active={activeSection === 'updates'}
          onClick={onSectionChange}
        />
        <NavButton
          id="about"
          label="About"
          icon={Info}
          active={activeSection === 'about'}
          onClick={onSectionChange}
        />
      </nav>
      <div className={styles.footer}>
        <Button variant="ghost" size="sm" className={styles.resetButton} onClick={handleResetAll}>
          <Icon icon={RotateCcw} size={16} className={styles.icon} />
          Reset to Defaults
        </Button>
      </div>
    </aside>
  );
}

function NavButton({
  id,
  label,
  icon,
  active,
  onClick,
}: {
  id: SettingsSection;
  label: string;
  icon: typeof Settings;
  active: boolean;
  onClick: (id: SettingsSection) => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.navItem} ${active ? styles.active : ''}`}
      onClick={() => onClick(id)}
    >
      <Icon icon={icon} size={16} className={styles.icon} />
      <span className={styles.label}>{label}</span>
    </button>
  );
}
