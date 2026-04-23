/**
 * Sync Service — barrel re-export.
 *
 * The implementation has been split into focused modules under ./sync/:
 *   - SyncService.ts — Core sync orchestration (pull, push, syncNow, auto-sync)
 *   - types.ts       — Sync types, events, results
 *   - helpers.ts     — Error classification utilities
 *   - index.ts       — Module re-exports
 */

export { SyncService } from './sync/index.js';
export type {
  SyncConflict,
  SyncResult,
  SyncState,
  SyncStatusEvent,
  SyncStatusListener,
} from './sync/index.js';
