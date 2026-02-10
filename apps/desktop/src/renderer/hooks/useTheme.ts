/**
 * Theme Hook
 *
 * Applies theme and accent color to document based on settings.
 * Supports: 'dark', 'light', 'system' + custom accentColor
 */

import { useEffect } from 'react';
import { useSettingsStore, selectAppearance } from '../stores/settings';

type Theme = 'dark' | 'light' | 'system';

/**
 * Get the resolved theme (dark or light) based on preference
 */
function resolveTheme(preference: Theme): 'dark' | 'light' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

/**
 * Apply theme to document root
 */
function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', theme);

  // Also update meta theme-color for native UI
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  const color = theme === 'dark' ? '#0a0b0d' : '#ffffff';
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', color);
  }
}

/**
 * Parse hex color to RGB components
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1]!, 16),
        g: parseInt(result[2]!, 16),
        b: parseInt(result[3]!, 16),
      }
    : null;
}

/**
 * Darken a hex color by a percentage
 */
function darkenHex(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = 1 - percent / 100;
  const r = Math.round(rgb.r * factor);
  const g = Math.round(rgb.g * factor);
  const b = Math.round(rgb.b * factor);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Apply accent color to CSS custom properties
 */
function applyAccentColor(hex: string, theme: 'dark' | 'light') {
  const root = document.documentElement;
  const rgb = hexToRgb(hex);

  if (!rgb) return;

  // Main accent color
  root.style.setProperty('--accent', hex);

  // Muted version (for backgrounds)
  const mutedOpacity = theme === 'dark' ? 0.15 : 0.12;
  root.style.setProperty('--accent-muted', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${mutedOpacity})`);

  // Strong version (darker for buttons on hover)
  root.style.setProperty('--accent-strong', darkenHex(hex, 15));

  // Also update CodeMirror accent-related tokens
  root.style.setProperty('--cm-heading', hex);
  root.style.setProperty('--cm-cursor', hex);
  root.style.setProperty('--cm-selection', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
  root.style.setProperty('--cm-bracket-match', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`);
  root.style.setProperty('--cm-quote-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
}

/**
 * Hook to manage theme and accent color based on settings
 */
export function useTheme() {
  const appearance = useSettingsStore(selectAppearance);
  const { theme: themePreference, accentColor } = appearance;

  // Apply theme
  useEffect(() => {
    const resolved = resolveTheme(themePreference);
    applyTheme(resolved);

    // If system preference, listen for changes
    if (themePreference === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themePreference]);

  // Apply accent color
  useEffect(() => {
    const resolved = resolveTheme(themePreference);
    applyAccentColor(accentColor, resolved);
  }, [accentColor, themePreference]);

  return {
    theme: themePreference,
    resolvedTheme: resolveTheme(themePreference),
  };
}
