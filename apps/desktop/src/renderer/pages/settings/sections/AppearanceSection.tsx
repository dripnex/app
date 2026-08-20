/**
 * Appearance Settings Section
 *
 * Theme, zoom level, and visual preferences.
 */

import { useSyncExternalStore } from 'react';
import { themeRegistryStore, type ThemeDefinition } from '@dripnex/plugin-api';
import { useSettingsStore, selectAppearance } from '../../../stores/settings';
import { usePerformanceStore } from '../../../stores/performanceStore';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { ACCENT_SWATCHES } from '../../../ui/tokens/palette';
import { Select } from '../../../ui/primitives';
import { ColorPicker, type ColorOption } from '../components/controls';
import styles from './Section.module.css';
import themeStyles from './AppearanceThemes.module.css';

const themeOptions = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

const zoomOptions = [
  { value: '0.8', label: '80%' },
  { value: '0.9', label: '90%' },
  { value: '1.0', label: '100% (Default)' },
  { value: '1.1', label: '110%' },
  { value: '1.2', label: '120%' },
  { value: '1.3', label: '130%' },
];

const performanceModeOptions = [
  { value: 'high', label: 'High (Full effects)' },
  { value: 'medium', label: 'Medium (Reduced blur)' },
  { value: 'low', label: 'Low (No blur)' },
];

const accentColorOptions: ColorOption[] = ACCENT_SWATCHES.map(swatch => ({
  value: swatch.value,
  label: swatch.label,
}));

export function AppearanceSection() {
  const appearance = useSettingsStore(selectAppearance);
  const updateAppearance = useSettingsStore(s => s.updateAppearance);
  const { mode: perfMode, setMode: setPerfMode } = usePerformanceStore();

  const pluginThemes = useSyncExternalStore(
    themeRegistryStore.subscribe,
    () => themeRegistryStore.getState().themes
  );
  const activeThemeId = useSyncExternalStore(
    themeRegistryStore.subscribe,
    () => themeRegistryStore.getState().activeThemeId
  );

  const theme = appearance.theme || 'dark';
  const zoomLevel = appearance.zoomLevel || '1.0';
  const accentColor = appearance.accentColor || '#5eead4';

  const handleThemeChange = (value: string) => {
    themeRegistryStore.getState().setActive(null);
    updateAppearance({
      theme: value as 'dark' | 'light' | 'system',
      activeThemeId: null,
      accentColor: value === 'light' ? '#0f766e' : '#5eead4',
    });
  };

  const handleAccentColorChange = (value: string) => {
    updateAppearance({ accentColor: value });
  };

  const handleZoomChange = (value: string) => {
    updateAppearance({ zoomLevel: value });
  };

  const handlePalette = (themeDef: ThemeDefinition | null) => {
    if (!themeDef) {
      themeRegistryStore.getState().setActive(null);
      updateAppearance({
        activeThemeId: null,
        accentColor: theme === 'light' ? '#0f766e' : '#5eead4',
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

  const handlePerfModeChange = (value: string) => {
    setPerfMode(value as 'high' | 'medium' | 'low');
    document.documentElement.dataset.perf = value;
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Appearance</h2>

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
            '--text-primary': theme === 'light' ? '#161513' : '#f4f4f5',
            '--text-muted': theme === 'light' ? 'rgba(22,21,19,0.45)' : 'rgba(255,255,255,0.35)',
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

      <SettingGroup title="Palette">
        <SettingRow
          label="Base"
          description="Default only. Picking Dark / Light / System leaves the named palette."
          htmlFor="theme"
        >
          <Select id="theme" value={theme} onChange={handleThemeChange} options={themeOptions} />
        </SettingRow>

        <SettingRow
          label="Accent"
          description="Overrides the palette accent if you want a different one"
          htmlFor="accentColor"
        >
          <ColorPicker
            id="accentColor"
            value={accentColor}
            onChange={handleAccentColorChange}
            colors={accentColorOptions}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Display">
        <SettingRow label="Zoom Level" description="Adjust the interface size" htmlFor="zoomLevel">
          <Select
            id="zoomLevel"
            value={zoomLevel}
            onChange={handleZoomChange}
            options={zoomOptions}
          />
        </SettingRow>

        <SettingRow
          label="Performance Mode"
          description="Adjust visual effects based on your hardware"
          htmlFor="performanceMode"
        >
          <Select
            id="performanceMode"
            value={perfMode}
            onChange={handlePerfModeChange}
            options={performanceModeOptions}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

function PaletteCard({
  name,
  description,
  active,
  tokens,
  onClick,
}: {
  name: string;
  description: string;
  active: boolean;
  tokens: Record<string, string>;
  onClick: () => void;
}) {
  const base = tokens['--bg-base'] ?? '#111';
  const surface = tokens['--bg-surface'] ?? base;
  const elevated = tokens['--bg-elevated'] ?? surface;
  const accent = tokens['--accent'] ?? '#5eead4';
  const text = tokens['--text-primary'] ?? '#f4f4f5';
  const muted = tokens['--text-muted'] ?? 'rgba(255,255,255,0.35)';
  const border = tokens['--border'] ?? 'rgba(255,255,255,0.08)';

  return (
    <button
      type="button"
      className={`${themeStyles.card} ${active ? themeStyles.cardActive : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <div
        className={themeStyles.preview}
        style={{ background: base, ['--swatch-border' as string]: border }}
        aria-hidden="true"
      >
        <div className={themeStyles.sidebar} style={{ background: surface }}>
          <i className={themeStyles.dot} style={{ background: accent }} />
          <i className={themeStyles.dot} style={{ background: muted }} />
          <i className={themeStyles.dot} style={{ background: muted }} />
        </div>
        <div className={themeStyles.list} style={{ background: elevated }}>
          <i className={themeStyles.row} style={{ background: accent, opacity: 0.35 }} />
          <i className={themeStyles.line} style={{ background: text, width: '86%' }} />
          <i className={themeStyles.line} style={{ background: muted, width: '64%' }} />
          <i className={themeStyles.line} style={{ background: muted, width: '72%' }} />
        </div>
        <div className={themeStyles.editor} style={{ background: base }}>
          <i className={themeStyles.line} style={{ background: text, width: '42%', height: 5 }} />
          <i className={themeStyles.line} style={{ background: muted, width: '88%' }} />
          <i className={themeStyles.line} style={{ background: muted, width: '74%' }} />
          <i className={themeStyles.line} style={{ background: muted, width: '80%' }} />
        </div>
      </div>
      <span className={themeStyles.meta}>
        <span className={themeStyles.name}>{name}</span>
        <span className={themeStyles.desc}>{description}</span>
      </span>
    </button>
  );
}
