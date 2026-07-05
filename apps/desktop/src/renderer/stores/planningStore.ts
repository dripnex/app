import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BoardStage } from '../../preload/index';

// ============================================================================
// Store Interface
// ============================================================================

interface PlanningStore {
  /** Per-column WIP limit. Absent/0 = no limit. */
  wipLimits: Partial<Record<BoardStage, number>>;
  setWipLimit: (stage: BoardStage, limit: number | null) => void;
}

// ============================================================================
// Store Implementation (persisted to localStorage)
// ============================================================================

export const usePlanningStore = create<PlanningStore>()(
  persist(
    set => ({
      wipLimits: {},
      setWipLimit: (stage, limit) =>
        set(state => {
          const next = { ...state.wipLimits };
          if (limit === null || !Number.isFinite(limit) || limit <= 0) {
            delete next[stage];
          } else {
            next[stage] = Math.floor(limit);
          }
          return { wipLimits: next };
        }),
    }),
    { name: 'dripnex-planning' }
  )
);
