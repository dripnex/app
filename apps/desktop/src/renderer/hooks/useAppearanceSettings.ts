import { useEffect } from 'react';
import { useSettingsStore, selectAppearance } from '../stores/settings';
import { computeHoverColor, hexToRgb } from '../utils/colorUtils';

/**
 * Apply appearance settings to the DOM.
 */
function applyAppearance(theme: string, accentColor: string, zoomLevel: string, isDark?: boolean): void {
  let resolved: string;
  if (theme === 'system') {
    resolved = (isDark ?? window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  } else {
    resolved = theme;
  }
  document.documentElement.setAttribute('data-theme', resolved);

  document.documentElement.style.setProperty('--accent', accentColor);
  document.documentElement.style.setProperty('--accent-primary', accentColor);

  const hoverColor = computeHoverColor(accentColor);
  document.documentElement.style.setProperty('--accent-hover', hoverColor);

  const rgb = hexToRgb(accentColor);
  if (rgb) {
    document.documentElement.style.setProperty(
      '--accent-muted',
      `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, 0.15)`
    );
  }

  document.body.style.zoom = zoomLevel;
}

/**
 * Hook to apply appearance settings to the DOM.
 *
 * Reads theme/accent/zoom from the Zustand settings store and applies
 * them to the DOM. Syncs nativeTheme source in the main process via IPC
 * and listens for system theme changes through the same channel.
 *
 * Call this hook once per window root component.
 */
export function useAppearanceSettings(): void {
  const appearance = useSettingsStore(selectAppearance);

  const theme = appearance?.theme || 'dark';
  const accentColor = appearance?.accentColor || '#5eead4';
  const zoomLevel = appearance?.zoomLevel || '1.0';

  // Apply settings to DOM
  useEffect(() => {
    applyAppearance(theme, accentColor, zoomLevel);
  }, [theme, accentColor, zoomLevel]);

  // Sync nativeTheme source in main process
  useEffect(() => {
    window.readied.theme.setSource(theme);
  }, [theme]);

  // Listen for system theme changes via IPC
  useEffect(() => {
    if (theme !== 'system') return;
    const unsub = window.readied.theme.onSystemChanged((isDark) => {
      applyAppearance('system', accentColor, zoomLevel, isDark);
    });
    return unsub;
  }, [theme, accentColor, zoomLevel]);
}
