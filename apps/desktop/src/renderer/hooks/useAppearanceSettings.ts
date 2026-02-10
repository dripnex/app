import { useEffect, useRef } from 'react';
import { useSettingsStore, selectGeneral } from '../stores/settings';
import { computeHoverColor, hexToRgb } from '../utils/colorUtils';

/**
 * Check if the settings IPC bridge is available.
 * It may not be during HMR, in dev tools, or before preload is rebuilt.
 */
function hasSettingsIPC(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.readied &&
    typeof window.readied.settings === 'object' &&
    window.readied.settings !== null
  );
}

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
 * Extracted so it can be called both from React effects and IPC callbacks.
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
 * Hook to initialize, apply, and sync appearance settings across windows.
 *
 * Responsibilities:
 * 1. Apply theme/accent/zoom from Zustand store to DOM
 * 2. Broadcast changes to other windows via IPC (settings:changed)
 * 3. Listen for incoming changes from other windows (settings:sync)
 *
 * Call this hook once per window root component.
 */
export function useAppearanceSettings(): void {
  const general = useSettingsStore(selectGeneral);
  const updateGeneral = useSettingsStore(s => s.updateGeneral);

  const theme = general.theme || 'dark';
  const accentColor = general.accentColor || '#5eead4';
  const zoomLevel = general.zoomLevel || '1.0';

  // Track previous values to detect changes for IPC broadcast
  const prevRef = useRef({ theme, accentColor, zoomLevel });
  const isExternalUpdate = useRef(false);

  // Apply settings to DOM whenever they change
  useEffect(() => {
    applyAppearance(theme, accentColor, zoomLevel);

    // Broadcast to other windows (only if this is a local change, not from IPC sync)
    if (!isExternalUpdate.current && hasSettingsIPC()) {
      const prev = prevRef.current;
      if (
        prev.theme !== theme ||
        prev.accentColor !== accentColor ||
        prev.zoomLevel !== zoomLevel
      ) {
        window.readied.settings.broadcast({
          theme,
          accentColor,
          zoomLevel,
        });
      }
    }
    isExternalUpdate.current = false;
    prevRef.current = { theme, accentColor, zoomLevel };
  }, [theme, accentColor, zoomLevel]);

  // Listen for OS theme changes when using 'system' theme
  useEffect(() => {
    if (theme !== 'system') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyAppearance('system', accentColor, zoomLevel);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme, accentColor, zoomLevel]);

  // Listen for settings sync from other windows
  useEffect(() => {
    if (!hasSettingsIPC()) return;

    const cleanup = window.readied.settings.onSync(incoming => {
      const incomingTheme = (incoming.theme as string) || undefined;
      const incomingAccent = (incoming.accentColor as string) || undefined;
      const incomingZoom = (incoming.zoomLevel as string) || undefined;

      // Mark as external so the effect doesn't re-broadcast
      isExternalUpdate.current = true;

      // Update Zustand store (which triggers the effect above to apply to DOM)
      const updates: Record<string, string> = {};
      if (incomingTheme) updates.theme = incomingTheme;
      if (incomingAccent) updates.accentColor = incomingAccent;
      if (incomingZoom) updates.zoomLevel = incomingZoom;

      if (Object.keys(updates).length > 0) {
        updateGeneral(updates as any);
      }
    });

    return cleanup;
  }, [updateGeneral]);
}
