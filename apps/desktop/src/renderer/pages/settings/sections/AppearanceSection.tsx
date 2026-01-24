/**
 * Appearance Settings Section
 *
 * Theme selection and accent color.
 */

import { Monitor, Moon, Sun } from 'lucide-react';
import { useSettingsStore, selectAppearance } from '../../../stores/settings';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import styles from './Section.module.css';

type ThemeOption = 'dark' | 'light' | 'system';

const themeOptions: { value: ThemeOption; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun size={16} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={16} /> },
  { value: 'system', label: 'System', icon: <Monitor size={16} /> },
];

/** Preset accent colors */
const accentPresets = [
  { value: '#5eead4', label: 'Teal' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#f43f5e', label: 'Rose' },
  { value: '#f97316', label: 'Orange' },
  { value: '#22c55e', label: 'Green' },
];

export function AppearanceSection() {
  const appearance = useSettingsStore(selectAppearance);
  const updateAppearance = useSettingsStore((s) => s.updateAppearance);

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Appearance</h2>

      <SettingGroup title="Theme">
        <SettingRow
          label="Color Theme"
          description="Choose your preferred color scheme"
        >
          <div className={styles.themeSelector}>
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.themeOption} ${
                  appearance.theme === option.value ? styles.themeOptionActive : ''
                }`}
                onClick={() => updateAppearance({ theme: option.value })}
                aria-pressed={appearance.theme === option.value}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Accent Color">
        <SettingRow
          label="Accent Color"
          description="Color for highlights and interactive elements"
          htmlFor="accentColor"
        >
          <div className={styles.colorPicker}>
            {accentPresets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`${styles.colorSwatch} ${
                  appearance.accentColor === preset.value ? styles.colorSwatchActive : ''
                }`}
                style={{ backgroundColor: preset.value }}
                onClick={() => updateAppearance({ accentColor: preset.value })}
                title={preset.label}
                aria-label={preset.label}
              />
            ))}
            <input
              type="color"
              id="accentColor"
              value={appearance.accentColor}
              onChange={(e) => updateAppearance({ accentColor: e.target.value })}
              className={styles.colorInput}
              title="Custom color"
            />
          </div>
        </SettingRow>
      </SettingGroup>
    </div>
  );
}
