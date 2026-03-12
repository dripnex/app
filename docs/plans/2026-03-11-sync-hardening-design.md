# Sync Hardening (1.6) Design

## Goal

Make sync robust and observable: auto-resume after offline, local sync history for debugging, and bandwidth tracking per cycle.

## What's NOT included

- **Delta sync** — Marked optional in roadmap. Premature optimization for markdown notes typically < 10KB.
- **Retry improvements** — Already implemented in ApiClient (3 retries, exponential backoff 1s/2s/4s).

## Components

### 1. Auto-Resume Sync on Reconnect

**Problem:** App goes offline → sync stops → user must manually trigger syncNow().

**Solution:**

- Renderer: `window.addEventListener('online', ...)` → debounce 2s → IPC `sync:syncNow`
- Main process: check `net.isOnline()` at start of each auto-sync tick, skip if offline
- SyncStatusIndicator shows "Back online, syncing..." briefly on reconnect

### 2. Sync History (Local SQLite Table)

**Problem:** No way to debug sync issues — scattered console.log calls.

**Solution:** New migration adding `sync_history` table:

```sql
CREATE TABLE sync_history (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',  -- running | success | partial | error
  notes_pulled INTEGER DEFAULT 0,
  notes_pushed INTEGER DEFAULT 0,
  notebooks_pulled INTEGER DEFAULT 0,
  notebooks_pushed INTEGER DEFAULT 0,
  tags_pulled INTEGER DEFAULT 0,
  tags_pushed INTEGER DEFAULT 0,
  conflicts INTEGER DEFAULT 0,
  bytes_sent INTEGER DEFAULT 0,
  bytes_received INTEGER DEFAULT 0,
  error_message TEXT
);
```

- SyncService writes one row per `syncNow()` call
- Prune to last 100 entries on write
- Exposed via IPC `sync:history` → renderer

### 3. Bandwidth Metrics

**Problem:** No visibility into sync data volume.

**Solution:** Instrument ApiClient.request() to track body sizes:

- Request: `Buffer.byteLength(JSON.stringify(body))` before fetch
- Response: `Buffer.byteLength(JSON.stringify(responseBody))` after parse
- Accumulate per sync cycle, store in `sync_history.bytes_sent/bytes_received`

### 4. Sync History UI

**Problem:** Users and developers can't see sync activity.

**Solution:** Expandable "Sync History" section in Settings > Account, below sync button:

- Table showing last 10 entries: time, status, items synced, bytes, errors
- Expandable to show more
- Color-coded status: green (success), yellow (partial), red (error)

## Architecture

```
Renderer (online event) ──→ IPC sync:syncNow ──→ SyncService.syncNow()
                                                      │
SyncService ──→ ApiClient.request() ──→ tracks bytes ──→ writes sync_history row
                                                      │
Settings UI ←── IPC sync:history ←── SQLiteRepository.getSyncHistory()
```

## Files to Touch

| Layer       | File                                                                   | Change                                       |
| ----------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| Migration   | `packages/storage-sqlite/src/migrations/017_sync_history.ts`           | New table                                    |
| Repository  | `packages/storage-sqlite/src/repositories/`                            | New SyncHistoryRepository or add to existing |
| SyncService | `apps/desktop/src/main/services/syncService.ts`                        | Write sync_history rows, accumulate metrics  |
| ApiClient   | `apps/desktop/src/main/services/apiClient.ts`                          | Return byte counts from request()            |
| IPC         | `apps/desktop/src/main/index.ts`                                       | Add `sync:history` handler                   |
| Preload     | `apps/desktop/src/preload/index.ts`                                    | Expose `sync.history()`                      |
| Store       | `apps/desktop/src/renderer/stores/syncStore.ts`                        | Add online/offline listeners                 |
| UI          | `apps/desktop/src/renderer/pages/settings/sections/AccountSection.tsx` | Sync history section                         |
| CSS         | `apps/desktop/src/renderer/pages/settings/sections/Section.module.css` | History table styles                         |
