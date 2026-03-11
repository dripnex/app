/**
 * Appearance Settings Section
 *
 * Theme, zoom level, and visual preferences.
 */

import { useSyncExternalStore } from 'react';
import { useSettingsStore, selectAppearance } from '../../../stores/settings';
import { usePerformanceStore } from '../../../stores/performanceStore';
import { themeRegistryStore } from '@readied/plugin-api';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { Select, ColorPicker, type ColorOption } from '../components/controls';
import styles from './Section.module.css';

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

const accentColorOptions: ColorOption[] = [
  { value: '#5eead4', label: 'Teal (Default)' },
  { value: '#60a5fa', label: 'Blue' },
  { value: '#a78bfa', label: 'Purple' },
  { value: '#f472b6', label: 'Pink' },
  { value: '#fb7185', label: 'Rose' },
  { value: '#fb923c', label: 'Orange' },
  { value: '#4ade80', label: 'Green' },
  { value: '#fbbf24', label: 'Amber' },
];

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
    updateAppearance({ theme: value as 'dark' | 'light' | 'system' });
  };

  const handleAccentColorChange = (value: string) => {
    updateAppearance({ accentColor: value });
  };

  const handleZoomChange = (value: string) => {
    updateAppearance({ zoomLevel: value });
  };

  const handlePluginThemeChange = (value: string) => {
    const newId = value === 'default' ? null : value;
    themeRegistryStore.getState().setActive(newId);
    updateAppearance({ activeThemeId: newId });
  };

  const handlePerfModeChange = (value: string) => {
    setPerfMode(value as 'high' | 'medium' | 'low');
    document.documentElement.dataset.perf = value;
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Appearance</h2>

      <SettingGroup title="Theme">
        <SettingRow
          label="Color Theme"
          description="Choose your preferred color scheme"
          htmlFor="theme"
        >
          <Select id="theme" value={theme} onChange={handleThemeChange} options={themeOptions} />
        </SettingRow>

        <SettingRow
          label="Accent Color"
          description="Choose your preferred accent color"
          htmlFor="accentColor"
        >
          <ColorPicker
            id="accentColor"
            value={accentColor}
            onChange={handleAccentColorChange}
            colors={accentColorOptions}
          />
        </SettingRow>
        {pluginThemes.length > 0 && (
          <SettingRow
            label="Plugin Theme"
            description="Apply a theme from an installed plugin"
            htmlFor="pluginTheme"
          >
            <Select
              id="pluginTheme"
              value={activeThemeId ?? 'default'}
              onChange={handlePluginThemeChange}
              options={[
                { value: 'default', label: 'Default' },
                ...pluginThemes.map(t => ({
                  value: t.id,
                  label: `${t.name} (${t.colorScheme})`,
                })),
              ]}
            />
          </SettingRow>
        )}
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
