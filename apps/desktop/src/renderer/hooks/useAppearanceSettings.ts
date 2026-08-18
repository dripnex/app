import { useEffect, useRef } from 'react';
import { useSettingsStore, selectAppearance } from '../stores/settings';
import { computeHoverColor, hexToRgb } from '../utils/colorUtils';

/**
 * Persisted IPC isDark value from the main process nativeTheme.
 * Used so that re-applies (accent/zoom changes) use the authoritative
 * main-process value instead of falling back to window.matchMedia.
 */
let nativeIsDark: boolean | undefined;

/**
 * Apply appearance settings to the DOM.
 */
function applyAppearance(
  theme: string,
  accentColor: string,
  zoomLevel: string,
  isDark?: boolean
): void {
  let resolved: string;
  if (theme === 'system') {
    // Prefer the IPC-supplied nativeTheme value, then the explicit param,
    // then fall back to matchMedia only as a last resort.
    const dark =
      isDark ?? nativeIsDark ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
    resolved = dark ? 'dark' : 'light';
  } else {
    resolved = theme;
  }
  // Use data-color-scheme for the dark/light resolved value.
  // data-theme is reserved for plugin theme identity (set by useThemeOverrides).
  document.documentElement.setAttribute('data-color-scheme', resolved);
  document.documentElement.style.colorScheme = resolved;

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
  const paletteActive = Boolean(appearance?.activeThemeId);

  // Keep a ref to current values so the IPC callback can access them
  const currentRef = useRef({ theme, accentColor, zoomLevel });
  currentRef.current = { theme, accentColor, zoomLevel };

  useEffect(() => {
    document.body.style.zoom = zoomLevel;
  }, [zoomLevel]);

  // A named palette owns color-scheme and accent. Base only paints Default.
  useEffect(() => {
    if (paletteActive) return;
    applyAppearance(theme, accentColor, zoomLevel);
  }, [theme, accentColor, zoomLevel, paletteActive]);

  // Sync nativeTheme source in main process
  useEffect(() => {
    window.dripnex?.theme?.setSource(theme);
  }, [theme]);

  // Listen for system theme changes via IPC
  useEffect(() => {
    if (theme !== 'system' || paletteActive) return;
    const unsub = window.dripnex?.theme?.onSystemChanged(isDark => {
      nativeIsDark = isDark;
      const { accentColor: ac, zoomLevel: zl } = currentRef.current;
      applyAppearance('system', ac, zl, isDark);
    });
    return unsub;
  }, [theme, paletteActive]);
}
