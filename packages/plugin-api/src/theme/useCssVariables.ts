/**
 * useCssVariables Hook
 *
 * Subscribes to the CSS variable store and applies plugin-registered
 * CSS custom properties to document.documentElement.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { cssVariableStore } from './cssVariableStore';

const subscribe = (cb: () => void) => cssVariableStore.subscribe(cb);
const getSnapshot = () => cssVariableStore.getState().registrations;

/**
 * Apply plugin-registered CSS variables to the document root.
 * Call this once in the app root (e.g. App.tsx).
 */
export function useCssVariables(): void {
  const registrations = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    const root = document.documentElement;
    const merged = cssVariableStore.getState().getMergedVariables();
    const previous = new Map<string, string | null>();

    // Snapshot current values, then apply merged variables
    for (const [prop, value] of Object.entries(merged)) {
      const prev = root.style.getPropertyValue(prop);
      previous.set(prop, prev || null);
      root.style.setProperty(prop, value);
    }

    // On cleanup, restore previous values instead of removing
    return () => {
      for (const [prop, prev] of previous) {
        if (prev) {
          root.style.setProperty(prop, prev);
        } else {
          root.style.removeProperty(prop);
        }
      }
    };
  }, [registrations]);
}
