import { useEffect } from 'react';
import { usePerformanceStore, type PerfMode } from '../stores/performanceStore';
import { useSettingsStore, selectAppearance } from '../stores/settings';

/**
 * Heuristics when Appearance → Performance is Auto:
 * reduced-motion or ≤4 cores → low; macOS → high; else medium.
 */
export function detectPerfMode(): PerfMode {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'low';
  if (navigator.hardwareConcurrency <= 4) return 'low';
  if (navigator.platform.includes('Mac')) return 'high';
  return 'medium';
}

/**
 * Sync glass blur to every window. The chosen mode is persisted in settings
 * so the Settings window and the main window stay in agreement.
 */
export function usePerformanceMode(): void {
  const mode = usePerformanceStore(state => state.mode);
  const setMode = usePerformanceStore(state => state.setMode);
  const setBaseMode = usePerformanceStore(state => state.setBaseMode);
  const saved = useSettingsStore(selectAppearance)?.performanceMode ?? 'auto';

  useEffect(() => {
    document.documentElement.dataset.perf = mode;
    // Native vibrancy stays on unless the user picked Low. Auto + Reduce
    // Motion used to flip this off and paint the window solid black.
    const frost = saved !== 'low';
    void window.dripnex?.windows?.setFrosted?.(frost);
  }, [mode, saved]);

  useEffect(() => {
    const auto = detectPerfMode();
    setBaseMode(auto);
    const next = saved === 'high' || saved === 'medium' || saved === 'low' ? saved : auto;
    setMode(next);
  }, [saved, setBaseMode, setMode]);
}
