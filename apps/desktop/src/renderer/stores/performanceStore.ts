import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

/**
 * Performance modes for glass/blur tuning.
 * - high: Full blur (macOS, high-end hardware)
 * - medium: Reduced blur (Windows/Linux)
 * - low: No blur (resize active, low-end, reduced-motion)
 */
export type PerfMode = 'high' | 'medium' | 'low';

// ============================================================================
// Store Interface
// ============================================================================

interface PerformanceState {
  /** Current active mode (may be 'low' during resize) */
  mode: PerfMode;
  /** Base mode to restore after resize */
  baseMode: PerfMode;
  /** Whether a resize operation is in progress */
  isResizing: boolean;

  // Actions
  setMode: (mode: PerfMode) => void;
  setBaseMode: (mode: PerfMode) => void;
  setResizing: (resizing: boolean) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const usePerformanceStore = create<PerformanceState>()((set) => ({
  // Initial state (will be set by usePerformanceMode hook on boot)
  mode: 'medium',
  baseMode: 'medium',
  isResizing: false,

  // Actions
  setMode: (mode) => set({ mode }),
  setBaseMode: (baseMode) => set({ baseMode }),
  setResizing: (isResizing) => set({ isResizing }),
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectMode = (state: PerformanceState) => state.mode;
export const selectBaseMode = (state: PerformanceState) => state.baseMode;
export const selectIsResizing = (state: PerformanceState) => state.isResizing;
