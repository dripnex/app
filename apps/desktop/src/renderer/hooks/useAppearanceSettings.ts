import { useEffect } from 'react';
import { useSettingsStore, selectAppearance } from '../stores/settings';
import { computeHoverColor, hexToRgb } from '../utils/colorUtils';

/**
 * Resolve 'system' theme to 'dark' or 'light' based on OS preference.
 */
function resolveTheme(theme: string): string {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

/**
 * Apply appearance settings to the DOM.
 */
function applyAppearance(theme: string, accentColor: string, zoomLevel: string): void {
  // Theme — resolve 'system' to actual value
  const resolved = resolveTheme(theme);
  document.documentElement.setAttribute('data-theme', resolved);

  // Accent color
  document.documentElement.style.setProperty('--accent', accentColor);
  document.documentElement.style.setProperty('--accent-primary', accentColor);

  // Hover variant
  const hoverColor = computeHoverColor(accentColor);
  document.documentElement.style.setProperty('--accent-hover', hoverColor);

  // Muted variant (accent at 15% opacity)
  const rgb = hexToRgb(accentColor);
  if (rgb) {
    document.documentElement.style.setProperty(
      '--accent-muted',
      `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, 0.15)`
    );
  }

  // Zoom
  document.body.style.zoom = zoomLevel;
}

/**
 * Hook to apply appearance settings to the DOM.
 *
 * Reads theme/accent/zoom from the Zustand settings store and applies
 * them to the DOM. Cross-window sync is handled by the settings store
 * itself (settingsStore.ts broadcasts full settings via IPC).
 *
 * Call this hook once per window root component.
 */
export function useAppearanceSettings(): void {
  const appearance = useSettingsStore(selectAppearance);

  const theme = appearance?.theme || 'dark';
  const accentColor = appearance?.accentColor || '#5eead4';
  const zoomLevel = appearance?.zoomLevel || '1.0';

  // Apply settings to DOM whenever they change
  useEffect(() => {
    applyAppearance(theme, accentColor, zoomLevel);
  }, [theme, accentColor, zoomLevel]);

  // Listen for OS theme changes when using 'system' theme
  useEffect(() => {
    if (theme !== 'system') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyAppearance('system', accentColor, zoomLevel);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme, accentColor, zoomLevel]);
}
