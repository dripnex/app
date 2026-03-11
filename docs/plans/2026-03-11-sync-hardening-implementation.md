# Sync Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make sync robust and observable — auto-resume after offline, local sync history for debugging, and bandwidth tracking per cycle.

**Architecture:** Instrument the existing ApiClient to track request/response sizes. Add a `sync_history` SQLite table for per-cycle metrics. Wire `online`/`offline` browser events to auto-trigger sync. Expose history via IPC to a new Settings UI section.

**Tech Stack:** Electron (main + renderer), SQLite (better-sqlite3), Zustand, React, Hono IPC

---

### Task 1: Add `sync_history` Migration

**Files:**
- Create: `packages/storage-sqlite/src/migrations/017_sync_history.ts`
- Modify: `packages/storage-sqlite/src/migrations/index.ts` (register migration)

**Step 1: Create the migration file**

Create `packages/storage-sqlite/src/migrations/017_sync_history.ts`:

```typescript
/**
 * Sync History Migration
 *
 * Adds a local table for tracking sync cycle metrics and debugging.
 */

import type { Migration } from '@readied/storage-core';

export const syncHistory: Migration = {
  version: 20260311000004,
  name: 'sync_history',
  up: `
    CREATE TABLE IF NOT EXISTS sync_history (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      notes_pulled INTEGER NOT NULL DEFAULT 0,
      notes_pushed INTEGER NOT NULL DEFAULT 0,
      notebooks_pulled INTEGER NOT NULL DEFAULT 0,
      notebooks_pushed INTEGER NOT NULL DEFAULT 0,
      tags_pulled INTEGER NOT NULL DEFAULT 0,
      tags_pushed INTEGER NOT NULL DEFAULT 0,
      conflicts INTEGER NOT NULL DEFAULT 0,
      bytes_sent INTEGER NOT NULL DEFAULT 0,
      bytes_received INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sync_history_started
    ON sync_history(started_at DESC);
  `,
};
```

**Step 2: Register the migration**

Open `packages/storage-sqlite/src/migrations/index.ts`. It exports an array of migrations. Add the import and append to the array:

```typescript
import { syncHistory } from './017_sync_history.js';

// Add to the migrations array:
export const migrations: Migration[] = [
  // ... existing migrations ...
  syncHistory,
];
```

**Step 3: Verify build**

Run: `pnpm --filter @readied/storage-sqlite build`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/storage-sqlite/src/migrations/017_sync_history.ts packages/storage-sqlite/src/migrations/index.ts
git commit -m "feat(storage): add sync_history migration for sync cycle metrics"
```

---

### Task 2: Add SyncHistory Repository Methods

**Files:**
- Modify: `packages/storage-sqlite/src/repositories/SQLiteNoteRepository.ts` (or whichever repository class has DB access)

**Context:** The storage-sqlite package uses better-sqlite3 directly. Repository methods use `this.db.prepare(sql).run(args)` pattern. Check the existing repository to understand the exact pattern before writing.

**Step 1: Explore the existing repository pattern**

Read `packages/storage-sqlite/src/repositories/SQLiteNoteRepository.ts` — look at the constructor and how `this.db` is used. Also check if there's a base repository class.

**Step 2: Add sync history methods**

Add these methods to the appropriate repository class (likely `SQLiteNoteRepository` since it already has sync-related methods like `getPendingChanges`, `markAsSynced`):

```typescript
/** Sync history entry for local debugging */
interface SyncHistoryEntry {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'success' | 'partial' | 'error';
  notesPulled: number;
  notesPushed: number;
  notebooksPulled: number;
  notebooksPushed: number;
  tagsPulled: number;
  tagsPushed: number;
  conflicts: number;
  bytesSent: number;
  bytesReceived: number;
  errorMessage: string | null;
}

/** Create a new sync history entry (status=running) */
createSyncHistoryEntry(id: string): void {
  this.db.prepare(`
    INSERT INTO sync_history (id, started_at, status)
    VALUES (?, datetime('now'), 'running')
  `).run(id);

  // Prune old entries — keep last 100
  this.db.prepare(`
    DELETE FROM sync_history WHERE id NOT IN (
      SELECT id FROM sync_history ORDER BY started_at DESC LIMIT 100
    )
  `).run();
}

/** Complete a sync history entry with results */
completeSyncHistoryEntry(
  id: string,
  status: 'success' | 'partial' | 'error',
  metrics: {
    notesPulled: number;
    notesPushed: number;
    notebooksPulled: number;
    notebooksPushed: number;
    tagsPulled: number;
    tagsPushed: number;
    conflicts: number;
    bytesSent: number;
    bytesReceived: number;
    errorMessage?: string;
  }
): void {
  this.db.prepare(`
    UPDATE sync_history SET
      completed_at = datetime('now'),
      status = ?,
      notes_pulled = ?,
      notes_pushed = ?,
      notebooks_pulled = ?,
      notebooks_pushed = ?,
      tags_pulled = ?,
      tags_pushed = ?,
      conflicts = ?,
      bytes_sent = ?,
      bytes_received = ?,
      error_message = ?
    WHERE id = ?
  `).run(
    status,
    metrics.notesPulled,
    metrics.notesPushed,
    metrics.notebooksPulled,
    metrics.notebooksPushed,
    metrics.tagsPulled,
    metrics.tagsPushed,
    metrics.conflicts,
    metrics.bytesSent,
    metrics.bytesReceived,
    metrics.errorMessage ?? null,
    id
  );
}

/** Get sync history entries (newest first) */
getSyncHistory(limit = 20): SyncHistoryEntry[] {
  const rows = this.db.prepare(`
    SELECT id, started_at, completed_at, status,
           notes_pulled, notes_pushed,
           notebooks_pulled, notebooks_pushed,
           tags_pulled, tags_pushed,
           conflicts, bytes_sent, bytes_received, error_message
    FROM sync_history
    ORDER BY started_at DESC
    LIMIT ?
  `).all(limit) as Array<Record<string, unknown>>;

  return rows.map(row => ({
    id: row.id as string,
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string | null,
    status: row.status as 'running' | 'success' | 'partial' | 'error',
    notesPulled: row.notes_pulled as number,
    notesPushed: row.notes_pushed as number,
    notebooksPulled: row.notebooks_pulled as number,
    notebooksPushed: row.notebooks_pushed as number,
    tagsPulled: row.tags_pulled as number,
    tagsPushed: row.tags_pushed as number,
    conflicts: row.conflicts as number,
    bytesSent: row.bytes_sent as number,
    bytesReceived: row.bytes_received as number,
    errorMessage: row.error_message as string | null,
  }));
}
```

**Step 3: Export the `SyncHistoryEntry` type**

Make sure `SyncHistoryEntry` is exported from the package's public API (check `packages/storage-sqlite/src/index.ts`).

**Step 4: Verify build**

Run: `pnpm --filter @readied/storage-sqlite build`

**Step 5: Commit**

```bash
git add packages/storage-sqlite/src/
git commit -m "feat(storage): add sync history repository methods"
```

---

### Task 3: Add Bandwidth Tracking to ApiClient

**Files:**
- Modify: `apps/desktop/src/main/services/apiClient.ts`

**Context:** The `request<T>()` method at line 167 handles all API calls. It uses `cross-fetch`. We need to track the byte size of request bodies and response bodies, and expose them to the caller.

**Step 1: Add a bandwidth accumulator**

Add a public property and methods to `ApiClient` (after `private refreshPromise` on line 152):

```typescript
/** Accumulated bytes for current sync cycle */
private _bytesSent = 0;
private _bytesReceived = 0;

/** Reset byte counters (call at start of sync cycle) */
resetBandwidthCounters(): void {
  this._bytesSent = 0;
  this._bytesReceived = 0;
}

/** Get accumulated bandwidth */
getBandwidth(): { bytesSent: number; bytesReceived: number } {
  return { bytesSent: this._bytesSent, bytesReceived: this._bytesReceived };
}
```

**Step 2: Instrument the `request()` method**

In the `request<T>()` method, add tracking. Before the `fetch` call (line 182), measure the request body:

```typescript
// Track request body size
if (options.body && typeof options.body === 'string') {
  this._bytesSent += Buffer.byteLength(options.body, 'utf8');
}
```

After `await response.json()` (line 211), measure the response. Replace line 211:

```typescript
const json = await response.json();
// Track response body size (approximate from JSON re-serialization)
const responseText = JSON.stringify(json);
this._bytesReceived += Buffer.byteLength(responseText, 'utf8');
return json as T;
```

**Step 3: Verify build**

Run: `pnpm --filter @readied/desktop build` (or just typecheck)

**Step 4: Commit**

```bash
git add apps/desktop/src/main/services/apiClient.ts
git commit -m "feat(api-client): add bandwidth tracking to request method"
```

---

### Task 4: Instrument SyncService with History Logging

**Files:**
- Modify: `apps/desktop/src/main/services/syncService.ts`

**Context:** `syncNow()` at line 390 orchestrates the full cycle. We need to:
1. Create a sync_history entry at the start
2. Track per-operation counts
3. Complete the entry at the end with totals + bandwidth

**Step 1: Add noteRepository dependency for sync history**

The `SyncService` constructor already has `noteRepository: SQLiteNoteRepository`. The sync history methods were added to that repository. No new dependency needed.

**Step 2: Modify `syncNow()` to record history**

Replace the `syncNow()` method (lines 390-493) to wrap with history tracking:

At the top of `syncNow()`, after the `isSyncing` check (line 401):

```typescript
// Generate unique ID for this sync cycle
const historyId = crypto.randomUUID();
this.noteRepository.createSyncHistoryEntry(historyId);
this.apiClient.resetBandwidthCounters();
```

Track counts throughout the method. After each pull/push operation, accumulate:

```typescript
let notesPulled = 0;
let notesPushed = 0;
let notebooksPulled = 0;
let notebooksPushed = 0;
let tagsPulled = 0;
let tagsPushed = 0;
let totalConflicts = 0;
```

After `pullNotebooks` (line 405): `notebooksPulled = nbPullResult.changes?.length ?? 0;`
After `pushNotebooks` (line 411): `notebooksPushed = nbPushResult.results?.filter(r => r.status === 'applied').length ?? 0;`
After `pull()` (line 417): `notesPulled = pullResult.changes.length;`
After push section (line 449): `notesPushed = changesPushed;`
After `pullTags` (line 464): `tagsPulled = tagPull.applied ?? 0;`
After `pushTags` (line 470): `tagsPushed = tagPush.pushed ?? 0;`
Conflicts: `totalConflicts = pullResult.conflicts.length;`

In the `return` statement (before return at line 475), complete the history:

```typescript
const bandwidth = this.apiClient.getBandwidth();
const hasErrors = !nbPullResult.success || !nbPushResult.success || !tagPull.success || !tagPush.success;
this.noteRepository.completeSyncHistoryEntry(historyId, hasErrors ? 'partial' : 'success', {
  notesPulled,
  notesPushed,
  notebooksPulled,
  notebooksPushed,
  tagsPulled,
  tagsPushed,
  conflicts: totalConflicts,
  bytesSent: bandwidth.bytesSent,
  bytesReceived: bandwidth.bytesReceived,
});
```

In the `catch` block (line 482):

```typescript
const bandwidth = this.apiClient.getBandwidth();
this.noteRepository.completeSyncHistoryEntry(historyId, 'error', {
  notesPulled: 0, notesPushed: 0,
  notebooksPulled: 0, notebooksPushed: 0,
  tagsPulled: 0, tagsPushed: 0,
  conflicts: 0,
  bytesSent: bandwidth.bytesSent,
  bytesReceived: bandwidth.bytesReceived,
  errorMessage: error instanceof Error ? error.message : 'Sync failed',
});
```

Also add a `getSyncHistory` passthrough method:

```typescript
/** Get sync history for UI display */
getSyncHistory(limit = 20) {
  return this.noteRepository.getSyncHistory(limit);
}
```

**Step 3: Verify build**

Run: `pnpm typecheck`

**Step 4: Commit**

```bash
git add apps/desktop/src/main/services/syncService.ts
git commit -m "feat(sync): record sync history with per-cycle metrics and bandwidth"
```

---

### Task 5: Add IPC Handler and Preload Bridge for Sync History

**Files:**
- Modify: `apps/desktop/src/main/index.ts` (add IPC handler)
- Modify: `apps/desktop/src/preload/index.ts` (add preload bridge)

**Step 1: Add IPC handler**

In `apps/desktop/src/main/index.ts`, find the sync IPC handlers section (around line 1458-1608). Add after the last sync handler:

```typescript
// Sync history
ipcMain.handle('sync:history', async (_event, limit?: number) => {
  try {
    const history = sync.getSyncHistory(limit);
    return { success: true, history };
  } catch (error) {
    return {
      success: false,
      history: [],
      error: error instanceof Error ? error.message : 'Failed to get sync history',
    };
  }
});
```

**Step 2: Add preload bridge**

In `apps/desktop/src/preload/index.ts`:

Add type in `ReadiedAPI` interface, inside the `sync:` section (after line 547):

```typescript
/** Get sync history */
history: (limit?: number) => Promise<{
  success: boolean;
  history: Array<{
    id: string;
    startedAt: string;
    completedAt: string | null;
    status: 'running' | 'success' | 'partial' | 'error';
    notesPulled: number;
    notesPushed: number;
    notebooksPulled: number;
    notebooksPushed: number;
    tagsPulled: number;
    tagsPushed: number;
    conflicts: number;
    bytesSent: number;
    bytesReceived: number;
    errorMessage: string | null;
  }>;
  error?: string;
}>;
```

Add implementation in the `sync:` section of the `api` object (after line 830):

```typescript
history: (limit?: number) => ipcRenderer.invoke('sync:history', limit),
```

**Step 3: Verify build**

Run: `pnpm typecheck`

**Step 4: Commit**

```bash
git add apps/desktop/src/main/index.ts apps/desktop/src/preload/index.ts
git commit -m "feat(ipc): expose sync history via IPC and preload bridge"
```

---

### Task 6: Auto-Resume Sync on Reconnect

**Files:**
- Modify: `apps/desktop/src/renderer/stores/syncStore.ts`

**Context:** The sync store uses Zustand. We need to add `online`/`offline` event listeners that auto-trigger `syncNow()` when connectivity returns. The store's `syncNow` action (line 62) already handles the full cycle.

**Step 1: Add online/offline listener setup**

Add a new action to the store interface (after `updateLastSyncAt` at line 41):

```typescript
/** Initialize online/offline listeners */
initNetworkListeners: () => () => void;
```

Add the implementation in the store (after `updateLastSyncAt` at line 163):

```typescript
/** Initialize online/offline listeners, returns cleanup function */
initNetworkListeners: () => {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const handleOnline = () => {
    // Debounce 2 seconds to avoid flapping
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const { status } = get();
      if (status === 'offline' || status === 'error') {
        set({ status: 'idle', error: null });
        get().syncNow().catch(() => {
          // Error already handled in syncNow
        });
      }
    }, 2000);
  };

  const handleOffline = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    set({ status: 'offline', error: 'No internet connection. Sync will resume when online.' });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Set initial state based on current connectivity
  if (!navigator.onLine) {
    set({ status: 'offline' });
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (debounceTimer) clearTimeout(debounceTimer);
  };
},
```

**Step 2: Wire up in the app initialization**

The listeners need to be initialized when the app starts. Find where `useSyncStore` is first used in the app (likely in `App.tsx` or a layout component) and add a `useEffect`:

```typescript
import { useSyncStore } from './stores/syncStore';

// In the component:
useEffect(() => {
  const cleanup = useSyncStore.getState().initNetworkListeners();
  return cleanup;
}, []);
```

Check `apps/desktop/src/renderer/App.tsx` or `apps/desktop/src/renderer/main.tsx` for the right place to add this.

**Step 3: Verify build**

Run: `pnpm typecheck`

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/stores/syncStore.ts apps/desktop/src/renderer/
git commit -m "feat(sync): auto-resume sync on network reconnect with debounce"
```

---

### Task 7: Sync History UI in Settings

**Files:**
- Modify: `apps/desktop/src/renderer/pages/settings/sections/AccountSection.tsx`
- Modify: `apps/desktop/src/renderer/pages/settings/sections/Section.module.css`

**Context:** The AccountSection already has a "Synchronization" SettingGroup (line 223). We add a collapsible "Sync History" section below the sync button.

**Step 1: Add sync history state and fetch**

In `AccountSection.tsx`, add state and data fetching:

```typescript
import { useState, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react'; // Add these imports

// Inside the component:
const [showHistory, setShowHistory] = useState(false);
const [syncHistory, setSyncHistory] = useState<Array<{
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  notesPulled: number;
  notesPushed: number;
  notebooksPulled: number;
  notebooksPushed: number;
  tagsPulled: number;
  tagsPushed: number;
  conflicts: number;
  bytesSent: number;
  bytesReceived: number;
  errorMessage: string | null;
}>>([]);

const loadSyncHistory = useCallback(async () => {
  try {
    const result = await window.readied.sync.history(10);
    if (result.success) {
      setSyncHistory(result.history);
    }
  } catch {
    // Non-critical — silently ignore
  }
}, []);

// Fetch history when section is expanded
useEffect(() => {
  if (showHistory) {
    loadSyncHistory();
  }
}, [showHistory, loadSyncHistory]);

// Also refresh after each sync
// In handleSync, after syncNow() succeeds:
if (showHistory) loadSyncHistory();
```

**Step 2: Add history UI**

Inside the "Synchronization" `<SettingGroup>`, after the offline message and before the closing tag (before line 250):

```tsx
<button
  type="button"
  className={styles.historyToggle}
  onClick={() => setShowHistory(!showHistory)}
>
  {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
  <span>Sync History</span>
</button>

{showHistory && (
  <div className={styles.syncHistoryTable}>
    {syncHistory.length === 0 ? (
      <div className={styles.placeholder}>No sync history yet</div>
    ) : (
      <table className={styles.historyTable}>
        <thead>
          <tr>
            <th>Time</th>
            <th>Status</th>
            <th>Items</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {syncHistory.map(entry => (
            <tr key={entry.id}>
              <td>{new Date(entry.startedAt).toLocaleString()}</td>
              <td>
                <span className={`${styles.historyStatus} ${styles[`historyStatus_${entry.status}`]}`}>
                  {entry.status}
                </span>
              </td>
              <td>
                ↓{entry.notesPulled + entry.notebooksPulled + entry.tagsPulled}{' '}
                ↑{entry.notesPushed + entry.notebooksPushed + entry.tagsPushed}
                {entry.conflicts > 0 && ` ⚠${entry.conflicts}`}
              </td>
              <td>
                ↑{formatBytes(entry.bytesSent)} ↓{formatBytes(entry.bytesReceived)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
)}
```

**Step 3: Add `formatBytes` helper**

At the top of the file (or inside the component):

```typescript
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

**Step 4: Add CSS styles**

Append to `Section.module.css`:

```css
/* Sync History */
.historyToggle {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
}

.historyToggle:hover {
  color: var(--text-primary);
}

.syncHistoryTable {
  margin-top: 0.5rem;
}

.historyTable {
  width: 100%;
  font-size: var(--text-xs);
  border-collapse: collapse;
}

.historyTable th {
  text-align: left;
  padding: 0.375rem 0.5rem;
  color: var(--text-tertiary);
  font-weight: 500;
  border-bottom: 1px solid var(--border-subtle);
}

.historyTable td {
  padding: 0.375rem 0.5rem;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
}

.historyTable tr:last-child td {
  border-bottom: none;
}

.historyStatus {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: var(--text-xs);
  font-weight: 500;
}

.historyStatus_success {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.historyStatus_partial {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.historyStatus_error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.historyStatus_running {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}
```

**Step 5: Verify build**

Run: `pnpm typecheck`

**Step 6: Commit**

```bash
git add apps/desktop/src/renderer/pages/settings/sections/AccountSection.tsx apps/desktop/src/renderer/pages/settings/sections/Section.module.css
git commit -m "feat(ui): add sync history section to Settings with bandwidth display"
```

---

### Summary

| Task | What | Files |
|------|------|-------|
| 1 | Migration: `sync_history` table | `storage-sqlite/migrations/` |
| 2 | Repository: CRUD for sync history | `SQLiteNoteRepository` |
| 3 | ApiClient: bandwidth tracking | `apiClient.ts` |
| 4 | SyncService: record history per cycle | `syncService.ts` |
| 5 | IPC + Preload: expose `sync:history` | `main/index.ts`, `preload/index.ts` |
| 6 | Auto-resume: online/offline listeners | `syncStore.ts` |
| 7 | Settings UI: sync history table | `AccountSection.tsx`, CSS |
