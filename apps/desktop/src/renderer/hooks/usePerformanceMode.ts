import { useEffect } from 'react';
import { usePerformanceStore, type PerfMode } from '../stores/performanceStore';

/**
 * Hook to initialize and sync performance mode.
 *
 * Responsibilities:
 * 1. Calculate baseMode on boot (once)
 * 2. Sync store.mode → document.documentElement.dataset.perf
 *
 * Heuristics (simple and robust):
 * - prefers-reduced-motion: reduce → 'low'
 * - navigator.hardwareConcurrency <= 4 → 'low'
 * - macOS (navigator.platform includes 'Mac') → 'high'
 * - else → 'medium' (Windows/Linux)
 *
 * Call this hook once in App.tsx.
 */
export function usePerformanceMode(): void {
  const mode = usePerformanceStore((state) => state.mode);
  const setMode = usePerformanceStore((state) => state.setMode);
  const setBaseMode = usePerformanceStore((state) => state.setBaseMode);

  // A) Single source of truth: store.mode → dataset.perf
  useEffect(() => {
    document.documentElement.dataset.perf = mode;
  }, [mode]);

  // B) Boot: calculate baseMode once
  useEffect(() => {
    const calculateBaseMode = (): PerfMode => {
      // prefers-reduced-motion → low
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return 'low';
      }

      // Low hardware concurrency → low
      if (navigator.hardwareConcurrency <= 4) {
        return 'low';
      }

      // macOS → high
      if (navigator.platform.includes('Mac')) {
        return 'high';
      }

      // Windows/Linux → medium
      return 'medium';
    };

    const baseMode = calculateBaseMode();
    setBaseMode(baseMode);
    setMode(baseMode); // This triggers the first useEffect above
  }, []); // Empty deps = only on boot
}
