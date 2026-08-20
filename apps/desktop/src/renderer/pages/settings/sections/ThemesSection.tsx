/**
 * Themes — named palettes. Dark/Light/System and accent stay on Appearance.
 */

import { useSyncExternalStore } from 'react';
import { themeRegistryStore, type ThemeDefinition } from '@dripnex/plugin-api';
import { useSettingsStore, selectAppearance } from '../../../stores/settings';
import styles from './Section.module.css';
import themeStyles from './AppearanceThemes.module.css';
import { PaletteCard } from './themes/PaletteCard';

export function ThemesSection() {
  const appearance = useSettingsStore(selectAppearance);
  const updateAppearance = useSettingsStore(s => s.updateAppearance);

  const pluginThemes = useSyncExternalStore(
    themeRegistryStore.subscribe,
    () => themeRegistryStore.getState().themes
  );
  const activeThemeId = useSyncExternalStore(
    themeRegistryStore.subscribe,
    () => themeRegistryStore.getState().activeThemeId
  );

  const theme = appearance.theme || 'dark';
  const accentColor = appearance.accentColor || '#5eead4';

  const handlePalette = (themeDef: ThemeDefinition | null) => {
    if (!themeDef) {
      themeRegistryStore.getState().setActive(null);
      updateAppearance({
        activeThemeId: null,
        accentColor: theme === 'light' ? '#0d8a80' : '#5eead4',
      });
      return;
    }
    themeRegistryStore.getState().setActive(themeDef.id);
    updateAppearance({
      activeThemeId: themeDef.id,
      theme: themeDef.colorScheme,
      accentColor: themeDef.tokens['--accent'] ?? accentColor,
    });
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Themes</h2>
      <p className={styles.lede}>
        Official combinations. A community theme is its own repo — same tokens, no core fork.
      </p>
      <div className={themeStyles.grid}>
        <PaletteCard
          name="Default"
          description={theme === 'light' ? 'Cool paper' : 'Quiet dark'}
          active={!activeThemeId}
          tokens={{
            '--bg-base': theme === 'light' ? '#f3f2ee' : '#0a0b0d',
            '--bg-surface': theme === 'light' ? '#e7e5df' : '#16171a',
            '--bg-elevated': theme === 'light' ? '#fffcf7' : '#1e2024',
            '--text-primary': theme === 'light' ? '#3a3834' : '#f4f4f5',
            '--text-muted': theme === 'light' ? 'rgba(58,56,52,0.5)' : 'rgba(255,255,255,0.35)',
            '--accent': accentColor,
            '--border': theme === 'light' ? 'rgba(22,21,19,0.12)' : 'rgba(255,255,255,0.08)',
          }}
          onClick={() => handlePalette(null)}
        />
        {pluginThemes.map(def => (
          <PaletteCard
            key={def.id}
            name={def.name}
            description={def.description ?? def.colorScheme}
            active={activeThemeId === def.id}
            tokens={def.tokens}
            onClick={() => handlePalette(def)}
          />
        ))}
      </div>
    </div>
  );
}
