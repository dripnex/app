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
  Code,
} from 'lucide';
import { Icon } from '../../../ui/icons/Icon';
import { Button, toast } from '../../../ui/primitives';
import { useSettingsStore } from '../../../stores/settings';
import { versionNewer } from '../sections/plugins/version';
import { SETTINGS_NAV_ITEMS, type SettingsNavId, type SettingsSection } from '../settingsNav';
import styles from './SettingsSidebar.module.css';

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

const NAV_ICONS: Record<SettingsNavId, typeof Settings> = {
  general: Settings,
  editor: FileText,
  themes: Paintbrush,
  appearance: Palette,
  ai: Sparkles,
  keybindings: Keyboard,
  hack: Code,
  plugins: Puzzle,
  account: User,
  encryption: KeyRound,
  integrations: Blocks,
  backup: Database,
  updates: Download,
  about: Info,
};

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
        {SETTINGS_NAV_ITEMS.map(item => {
          if (item.id === 'plugins') {
            return (
              <div className={styles.group} key={item.id}>
                <NavButton
                  id="plugins"
                  label={item.label}
                  icon={NAV_ICONS.plugins}
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
            );
          }

          return (
            <NavButton
              key={item.id}
              id={item.id}
              label={item.label}
              icon={NAV_ICONS[item.id]}
              active={activeSection === item.id}
              onClick={onSectionChange}
            />
          );
        })}
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
