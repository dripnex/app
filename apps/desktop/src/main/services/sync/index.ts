/**
 * Sync module — re-exports for convenient importing.
 */

export { SyncService } from './SyncService.js';
export { SyncCursorStore } from './cursorStore.js';
export { parseSyncedNote, serializeSyncedNote } from './envelope.js';
export type {
  SyncConflict,
  SyncResult,
  SyncState,
  SyncStatusEvent,
  SyncStatusListener,
} from './types.js';
