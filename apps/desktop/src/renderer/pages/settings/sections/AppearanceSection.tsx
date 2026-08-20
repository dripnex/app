/**
 * Appearance Settings Section
 *
 * Base palette, accent, zoom, performance. Named themes live on Themes.
 */

import { themeRegistryStore } from '@dripnex/plugin-api';
import { useSyncExternalStore } from 'react';
import { useSettingsStore, selectAppearance } from '../../../stores/settings';
import { detectPerfMode } from '../../../hooks/usePerformanceMode';
import { usePerformanceStore } from '../../../stores/performanceStore';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { SettingSelect } from '../components/SettingSelect';
import { ACCENT_SWATCHES } from '../../../ui/tokens/palette';
import { ColorPicker, RangeInput, type ColorOption } from '../components/controls';
import { SettingsPage } from '../components/SettingsPage';

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
  { value: 'auto', label: 'Auto' },
  { value: 'high', label: 'High (Full blur)' },
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
  const { setMode: setPerfMode } = usePerformanceStore();
  const perfMode = appearance.performanceMode || 'auto';
  const frostTransparency = appearance.frostTransparency ?? 40;
  const frosted = Boolean(
    useSyncExternalStore(
      themeRegistryStore.subscribe,
      () => themeRegistryStore.getState().getActiveTheme()?.frosted
    )
  );

  const theme = appearance.theme || 'dark';
  const zoomLevel = appearance.zoomLevel || '1.0';
  const accentColor = appearance.accentColor || '#5eead4';
  const accentOptions: ColorOption[] = accentColorOptions.some(
    option => option.value.toLowerCase() === accentColor.toLowerCase()
  )
    ? accentColorOptions
    : [{ value: accentColor, label: 'Theme' }, ...accentColorOptions];

  const handleThemeChange = (value: string) => {
    themeRegistryStore.getState().setActive(null);
    updateAppearance({
      theme: value as 'dark' | 'light' | 'system',
      activeThemeId: null,
      accentColor: value === 'light' ? '#0d8a80' : '#5eead4',
    });
  };

  const handlePerfModeChange = (value: string) => {
    const performanceMode =
      value === 'high' || value === 'medium' || value === 'low' || value === 'auto'
        ? value
        : 'auto';
    updateAppearance({ performanceMode });
    setPerfMode(performanceMode === 'auto' ? detectPerfMode() : performanceMode);
  };

  return (
    <SettingsPage
      title="Appearance"
      lede="Zoom, accent, and effects. Named palettes are under Themes."
    >
      <SettingGroup title="Palette">
        <SettingSelect
          label="Base"
          description="Default only. Dark / Light / System leaves a named theme."
          htmlFor="theme"
          value={theme}
          onChange={handleThemeChange}
          options={themeOptions}
        />
        <SettingRow
          label="Accent"
          description="Overrides the palette accent if you want a different one"
          htmlFor="accentColor"
        >
          <ColorPicker
            id="accentColor"
            value={accentColor}
            onChange={value => updateAppearance({ accentColor: value })}
            colors={accentOptions}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Display">
        <SettingSelect
          label="Zoom Level"
          description="Adjust the interface size"
          htmlFor="zoomLevel"
          value={zoomLevel}
          onChange={value => updateAppearance({ zoomLevel: value })}
          options={zoomOptions}
        />
        <SettingSelect
          label="Performance Mode"
          description="Low turns off window frost and menu blur"
          htmlFor="performanceMode"
          value={perfMode}
          onChange={handlePerfModeChange}
          options={performanceModeOptions}
        />
        <SettingRow
          label="Transparency"
          description={
            !frosted
              ? 'Pick a frosted palette under Themes to use this'
              : perfMode === 'low'
                ? 'Turn Performance off Low to see the desktop'
                : 'How much desktop shows through Glass, Midnight, Ember, and Ion'
          }
          htmlFor="frostTransparency"
        >
          <RangeInput
            id="frostTransparency"
            value={frostTransparency}
            onChange={value => updateAppearance({ frostTransparency: value })}
            min={0}
            max={100}
            step={5}
            disabled={!frosted || perfMode === 'low'}
          />
        </SettingRow>
      </SettingGroup>
    </SettingsPage>
  );
}
