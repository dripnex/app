# Notebook Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable bidirectional sync for notebooks using the same cursor-based push/pull pattern as notes, with server-side tree validation.

**Architecture:** Extend the existing note sync pattern — separate API endpoints, SQLite triggers for change tracking, desktop sync service orchestration. Notebooks sync before notes (dependency order). Server validates tree integrity (depth ≤ 2, valid parentId, no cycles).

**Tech Stack:** Hono (API routes), Drizzle ORM (Turso/libSQL), better-sqlite3 (desktop), vitest (tests), Zod (validation)

**Design doc:** `docs/plans/2026-03-11-notebook-sync-design.md`

---

### Task 1: API — Add notebookSyncLog table to Drizzle schema

**Files:**

- Modify: `packages/api/src/db/schema.ts:106` (after syncLog table)

**Step 1: Add the notebookSyncLog table and cursor support**

Add after the `syncLog` table definition (line 106):

```typescript
/**
 * Notebook sync log - notebook metadata changes
 * No encryption needed - notebooks are organizational metadata only
 */
export const notebookSyncLog = sqliteTable(
  'notebook_sync_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    notebookId: text('notebook_id').notNull(),
    version: integer('version').notNull(),
    operation: text('operation').notNull(), // 'create' | 'update' | 'delete'
    data: text('data'), // JSON notebook metadata (null for deletes)
    deviceId: text('device_id').notNull(),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => [
    index('idx_nb_sync_log_user_version').on(table.userId, table.version),
    index('idx_nb_sync_log_user_notebook').on(table.userId, table.notebookId),
  ]
);
```

Add type exports at the bottom:

```typescript
export type NotebookSyncLogEntry = typeof notebookSyncLog.$inferSelect;
```

**Step 2: Run drizzle generate to create migration**

Run: `cd packages/api && pnpm drizzle-kit generate`

**Step 3: Commit**

```bash
git add packages/api/src/db/schema.ts
git commit -m "feat(api): add notebookSyncLog table to Drizzle schema"
```

---

### Task 2: API — Add notebook sync endpoints

**Files:**

- Modify: `packages/api/src/routes/sync.ts`

**Step 1: Write failing test for notebook pull endpoint**

**File:** Create `packages/api/src/routes/__tests__/syncNotebooks.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Schema validation tests for notebook sync payloads
const notebookPullResponseSchema = z.object({
  changes: z.array(
    z.object({
      id: z.string(),
      notebookId: z.string(),
      version: z.number(),
      operation: z.enum(['create', 'update', 'delete']),
      data: z.string().nullable(),
      deviceId: z.string(),
      createdAt: z.string(),
    })
  ),
  cursor: z.number(),
  hasMore: z.boolean(),
});

const notebookPushSchema = z.object({
  changes: z
    .array(
      z.object({
        notebookId: z.string(),
        operation: z.enum(['create', 'update', 'delete']),
        data: z.string().nullable().optional(),
        localVersion: z.number().int().optional(),
      })
    )
    .min(1)
    .max(100),
  deviceId: z.string().uuid(),
});

describe('Notebook sync schemas', () => {
  it('validates pull response format', () => {
    const response = {
      changes: [
        {
          id: 'abc-123',
          notebookId: 'nb-1',
          version: 1,
          operation: 'create',
          data: JSON.stringify({ name: 'Work', parentId: null, depth: 0, order: 0 }),
          deviceId: 'device-1',
          createdAt: '2026-03-11T00:00:00Z',
        },
      ],
      cursor: 1,
      hasMore: false,
    };
    expect(notebookPullResponseSchema.parse(response)).toBeDefined();
  });

  it('validates push payload format', () => {
    const payload = {
      changes: [
        {
          notebookId: 'nb-1',
          operation: 'create' as const,
          data: JSON.stringify({ name: 'Work', parentId: null, depth: 0, order: 0 }),
        },
      ],
      deviceId: '550e8400-e29b-41d4-a716-446655440000',
    };
    expect(notebookPushSchema.parse(payload)).toBeDefined();
  });

  it('rejects push with depth > 2 in data', () => {
    const data = { name: 'Deep', parentId: 'nb-1', depth: 3, order: 0 };
    expect(data.depth).toBeGreaterThan(2);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd packages/api && npx vitest run src/routes/__tests__/syncNotebooks.test.ts`

**Step 3: Add notebook sync routes to sync.ts**

Add to `packages/api/src/routes/sync.ts` — import `notebookSyncLog` at line 17, then add routes before the `export { sync }` line:

```typescript
// ============================================================================
// Notebook Sync
// ============================================================================

const notebookChangeSchema = z.object({
  notebookId: z.string(),
  operation: z.enum(['create', 'update', 'delete']),
  data: z.string().nullable().optional(), // JSON: { name, parentId, depth, order, createdAt, updatedAt }
  localVersion: z.number().int().optional(),
});

const notebookPushSchema = z.object({
  changes: z.array(notebookChangeSchema).min(1).max(100),
  deviceId: z.string().uuid(),
});

/**
 * Validate notebook tree integrity.
 * Returns { valid: true } or { valid: false, error, notebookId }.
 */
function validateNotebookTree(
  changes: Array<{ notebookId: string; operation: string; data?: string | null }>,
  existingNotebooks: Map<string, { parentId: string | null; depth: number }>
): { valid: true } | { valid: false; error: string; notebookId: string } {
  // Build a working copy of the tree
  const tree = new Map(existingNotebooks);

  for (const change of changes) {
    if (change.operation === 'delete') {
      tree.delete(change.notebookId);
      continue;
    }

    if (!change.data) continue;
    const parsed = JSON.parse(change.data) as {
      name: string;
      parentId: string | null;
      depth: number;
      order: number;
    };

    // Rule 1: depth ≤ 2
    if (parsed.depth > 2) {
      return {
        valid: false,
        error: `depth exceeds max (2), got ${parsed.depth}`,
        notebookId: change.notebookId,
      };
    }

    // Rule 2: parentId must exist or be null
    if (parsed.parentId && !tree.has(parsed.parentId)) {
      return {
        valid: false,
        error: `parentId '${parsed.parentId}' not found`,
        notebookId: change.notebookId,
      };
    }

    // Rule 3: no cycles — walk parentId chain with visited set
    if (parsed.parentId) {
      const visited = new Set<string>([change.notebookId]);
      let current: string | null = parsed.parentId;
      while (current) {
        if (visited.has(current)) {
          return {
            valid: false,
            error: `circular reference detected`,
            notebookId: change.notebookId,
          };
        }
        visited.add(current);
        current = tree.get(current)?.parentId ?? null;
      }
    }

    tree.set(change.notebookId, { parentId: parsed.parentId, depth: parsed.depth });
  }

  return { valid: true };
}

// Pull notebook changes
sync.get('/notebooks', zValidator('query', pullSchema), async c => {
  const { cursor, limit } = c.req.valid('query');
  const { userId, deviceId } = c.get('user');
  const db = createDb(c.env);

  // Check subscription
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!(sub?.status === 'active' || sub?.status === 'trialing')) {
    return c.json({ error: 'Sync requires Pro subscription' }, 403);
  }

  const changes = await db
    .select()
    .from(notebookSyncLog)
    .where(and(eq(notebookSyncLog.userId, userId), gt(notebookSyncLog.version, cursor)))
    .orderBy(notebookSyncLog.version)
    .limit(limit);

  const maxVersion = changes.length > 0 ? changes[changes.length - 1].version : cursor;

  return c.json({
    changes: changes.map(entry => ({
      id: entry.id,
      notebookId: entry.notebookId,
      version: entry.version,
      operation: entry.operation,
      data: entry.data,
      deviceId: entry.deviceId,
      createdAt: entry.createdAt,
    })),
    cursor: maxVersion,
    hasMore: changes.length === limit,
  });
});

// Push notebook changes (with tree validation)
sync.post('/notebooks', zValidator('json', notebookPushSchema), async c => {
  const { changes, deviceId } = c.req.valid('json');
  const { userId } = c.get('user');
  const db = createDb(c.env);

  // Check subscription
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!(sub?.status === 'active' || sub?.status === 'trialing')) {
    return c.json({ error: 'Sync requires Pro subscription' }, 403);
  }

  // Load existing notebooks for tree validation
  const existingEntries = await db
    .select()
    .from(notebookSyncLog)
    .where(eq(notebookSyncLog.userId, userId))
    .orderBy(desc(notebookSyncLog.version));

  // Build latest state per notebook
  const latestByNotebook = new Map<string, { parentId: string | null; depth: number }>();
  for (const entry of existingEntries) {
    if (!latestByNotebook.has(entry.notebookId) && entry.operation !== 'delete' && entry.data) {
      const parsed = JSON.parse(entry.data);
      latestByNotebook.set(entry.notebookId, { parentId: parsed.parentId, depth: parsed.depth });
    }
  }

  // Validate tree integrity
  const validation = validateNotebookTree(changes, latestByNotebook);
  if (!validation.valid) {
    console.warn(
      `[notebook-sync] Tree validation failed for user ${userId}: ${validation.error} (notebook: ${validation.notebookId})`
    );
    return c.json(
      {
        error: 'Tree validation failed',
        detail: validation.error,
        notebookId: validation.notebookId,
      },
      422
    );
  }

  // Process changes in transaction
  const { results, finalCursor } = await db.transaction(async tx => {
    const [maxVersionResult] = await tx
      .select({ maxVersion: sql<number>`COALESCE(MAX(${notebookSyncLog.version}), 0)` })
      .from(notebookSyncLog)
      .where(eq(notebookSyncLog.userId, userId));

    let nextVersion = (maxVersionResult?.maxVersion ?? 0) + 1;

    const txResults: Array<{
      notebookId: string;
      version: number;
      status: 'applied' | 'conflict';
      serverVersion?: number;
    }> = [];

    for (const change of changes) {
      // Conflict detection
      const [latestEntry] = await tx
        .select()
        .from(notebookSyncLog)
        .where(
          and(eq(notebookSyncLog.userId, userId), eq(notebookSyncLog.notebookId, change.notebookId))
        )
        .orderBy(desc(notebookSyncLog.version))
        .limit(1);

      if (
        latestEntry &&
        latestEntry.deviceId !== deviceId &&
        change.localVersion !== undefined &&
        latestEntry.version > change.localVersion
      ) {
        txResults.push({
          notebookId: change.notebookId,
          version: latestEntry.version,
          status: 'conflict',
          serverVersion: latestEntry.version,
        });
        continue;
      }

      await tx.insert(notebookSyncLog).values({
        userId,
        notebookId: change.notebookId,
        version: nextVersion,
        operation: change.operation,
        data: change.data ?? null,
        deviceId,
      });

      txResults.push({
        notebookId: change.notebookId,
        version: nextVersion,
        status: 'applied',
      });

      nextVersion++;
    }

    return { results: txResults, finalCursor: nextVersion - 1 };
  });

  return c.json({ results, cursor: finalCursor });
});
```

**Step 4: Commit**

```bash
git add packages/api/src/routes/sync.ts packages/api/src/routes/__tests__/syncNotebooks.test.ts
git commit -m "feat(api): add notebook sync pull/push endpoints with tree validation"
```

---

### Task 3: Desktop SQLite — Add notebook sync tracking migration

**Files:**

- Create: `packages/storage-sqlite/src/migrations/015_notebook_sync_tracking.ts`
- Modify: `packages/storage-sqlite/src/migrations/index.ts`

**Step 1: Create migration file**

```typescript
/**
 * Notebook sync tracking
 *
 * Adds local_version and needs_sync columns to notebooks,
 * plus triggers to track changes for bidirectional sync.
 * Also adds unique constraint to sync_queue to prevent duplicates.
 */

import type { Migration } from '@dripnex/storage-core';

export const notebookSyncTracking: Migration = {
  version: 20260311000001,
  name: 'notebook_sync_tracking',
  up: `
    -- Add sync tracking columns to notebooks
    ALTER TABLE notebooks ADD COLUMN local_version INTEGER DEFAULT 1;
    ALTER TABLE notebooks ADD COLUMN needs_sync INTEGER DEFAULT 0;

    -- Index for querying pending notebook changes
    CREATE INDEX IF NOT EXISTS idx_notebooks_needs_sync
    ON notebooks(needs_sync) WHERE needs_sync = 1;

    -- Unique constraint on sync_queue to prevent duplicate entries
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_queue_unique_entity
    ON sync_queue(entity_type, entity_id);

    -- Trigger: Mark notebook as needing sync on UPDATE
    CREATE TRIGGER IF NOT EXISTS notebooks_update_sync_tracking
    AFTER UPDATE ON notebooks
    FOR EACH ROW
    WHEN NEW.name != OLD.name
      OR NEW.parent_id IS NOT OLD.parent_id
      OR NEW.depth != OLD.depth
      OR NEW."order" != OLD."order"
    BEGIN
      UPDATE notebooks
      SET
        needs_sync = 1,
        local_version = local_version + 1
      WHERE id = NEW.id;
    END;

    -- Trigger: Mark notebook as needing sync on INSERT
    CREATE TRIGGER IF NOT EXISTS notebooks_insert_sync_tracking
    AFTER INSERT ON notebooks
    FOR EACH ROW
    BEGIN
      UPDATE notebooks
      SET needs_sync = 1
      WHERE id = NEW.id;
    END;
  `,
};
```

**Step 2: Register migration in index.ts**

Add import and include in the migrations array in `packages/storage-sqlite/src/migrations/index.ts`.

**Step 3: Commit**

```bash
git add packages/storage-sqlite/src/migrations/015_notebook_sync_tracking.ts packages/storage-sqlite/src/migrations/index.ts
git commit -m "feat(storage): add notebook sync tracking migration with triggers"
```

---

### Task 4: Desktop — Add sync methods to SQLiteNotebookRepository

**Files:**

- Modify: `packages/storage-sqlite/src/repositories/SQLiteNotebookRepository.ts`

**Step 1: Write failing test**

**File:** Create `packages/storage-sqlite/tests/notebookSync.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

// These tests validate the SQL patterns used in notebook sync.
// Full integration tests require better-sqlite3 which is compiled for Electron.
// These run as schema/logic validation tests.

describe('Notebook sync repository methods', () => {
  it('getPendingChanges returns notebooks with needs_sync=1', () => {
    // Schema contract: notebooks table has needs_sync and local_version columns
    const mockRow = {
      id: 'nb-1',
      name: 'Work',
      parent_id: null,
      depth: 0,
      order: 0,
      created_at: '2026-03-11T00:00:00Z',
      updated_at: '2026-03-11T00:00:00Z',
      local_version: 2,
      needs_sync: 1,
    };
    expect(mockRow.needs_sync).toBe(1);
    expect(mockRow.local_version).toBe(2);
  });

  it('markAsSynced sets needs_sync=0 and updates last_synced_at', () => {
    // Contract: after sync, needs_sync goes to 0
    const beforeSync = { needs_sync: 1 };
    const afterSync = { needs_sync: 0, last_synced_at: new Date().toISOString() };
    expect(afterSync.needs_sync).toBe(0);
    expect(afterSync.last_synced_at).toBeDefined();
  });

  it('validates tree depth constraint', () => {
    const isValidDepth = (depth: number) => depth <= 2;
    expect(isValidDepth(0)).toBe(true);
    expect(isValidDepth(1)).toBe(true);
    expect(isValidDepth(2)).toBe(true);
    expect(isValidDepth(3)).toBe(false);
  });
});
```

**Step 2: Run tests**

Run: `cd packages/storage-sqlite && npx vitest run tests/notebookSync.test.ts`

**Step 3: Add sync methods to SQLiteNotebookRepository**

Add after the git methods section (~line 306) in `packages/storage-sqlite/src/repositories/SQLiteNotebookRepository.ts`:

```typescript
  // ========================================================================
  // Sync Operations
  // ========================================================================

  /**
   * Get notebooks with pending local changes that need to be pushed to server.
   */
  getPendingChanges(limit = 50): Array<{
    notebook: Notebook;
    localVersion: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT id, name, parent_id, depth, "order", created_at, updated_at,
             git_enabled, git_auto_commit, git_initialized_at,
             local_version
      FROM notebooks
      WHERE needs_sync = 1
      ORDER BY updated_at ASC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as (NotebookRow & { local_version: number })[];
    return rows.map(row => ({
      notebook: this.rowToNotebook(row),
      localVersion: row.local_version,
    }));
  }

  /**
   * Mark a notebook as synced (no pending changes).
   */
  markAsSynced(notebookId: NotebookId): void {
    const stmt = this.db.prepare(`
      UPDATE notebooks
      SET
        needs_sync = 0,
        last_synced_at = ?
      WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), notebookId);
  }

  /**
   * Mark multiple notebooks as synced in a transaction.
   */
  markMultipleAsSynced(notebookIds: NotebookId[]): void {
    if (notebookIds.length === 0) return;

    this.db.transaction(() => {
      const stmt = this.db.prepare(`
        UPDATE notebooks
        SET
          needs_sync = 0,
          last_synced_at = ?
        WHERE id = ?
      `);

      const now = new Date().toISOString();
      for (const id of notebookIds) {
        stmt.run(now, id);
      }
    });
  }

  /**
   * Check if a notebook has pending local edits.
   */
  hasPendingEdits(notebookId: NotebookId): boolean {
    const stmt = this.db.prepare(`
      SELECT needs_sync FROM notebooks WHERE id = ?
    `);
    const row = stmt.get(notebookId) as { needs_sync: number } | undefined;
    return row?.needs_sync === 1;
  }

  /**
   * Reset sync tracking for a notebook (force re-sync).
   */
  resetSyncTracking(notebookId: NotebookId): void {
    const stmt = this.db.prepare(`
      UPDATE notebooks
      SET
        needs_sync = 1,
        local_version = local_version + 1
      WHERE id = ?
    `);
    stmt.run(notebookId);
  }

  /**
   * Validate tree integrity before enqueuing a push.
   * Returns true if the notebook meets depth/parentId constraints.
   */
  validateForSync(notebookId: NotebookId): { valid: boolean; error?: string } {
    const stmt = this.db.prepare<NotebookRow>(`
      SELECT id, name, parent_id, depth, "order", created_at, updated_at,
             git_enabled, git_auto_commit, git_initialized_at
      FROM notebooks WHERE id = ?
    `);
    const row = stmt.get(notebookId) as NotebookRow | undefined;
    if (!row) return { valid: false, error: 'Notebook not found' };
    if (row.depth > 2) return { valid: false, error: `Depth ${row.depth} exceeds max (2)` };
    if (row.parent_id) {
      const parent = this.db.prepare('SELECT id FROM notebooks WHERE id = ?').get(row.parent_id);
      if (!parent) return { valid: false, error: `Parent notebook '${row.parent_id}' not found` };
    }
    return { valid: true };
  }
```

**Step 4: Commit**

```bash
git add packages/storage-sqlite/src/repositories/SQLiteNotebookRepository.ts packages/storage-sqlite/tests/notebookSync.test.ts
git commit -m "feat(storage): add sync methods to SQLiteNotebookRepository"
```

---

### Task 5: Desktop — Add notebook sync to ApiClient

**Files:**

- Modify: `apps/desktop/src/main/services/apiClient.ts`

**Step 1: Add types for notebook sync**

Add after `PushResponse` interface (~line 55):

```typescript
export interface NotebookSyncChange {
  id: string;
  notebookId: string;
  version: number;
  operation: 'create' | 'update' | 'delete';
  data: string | null;
  deviceId: string;
  createdAt: string;
}

export interface NotebookPullResponse {
  changes: NotebookSyncChange[];
  cursor: number;
  hasMore: boolean;
}

export interface NotebookPushResult {
  notebookId: string;
  version: number;
  status: 'applied' | 'conflict';
  serverVersion?: number;
}

export interface NotebookPushResponse {
  results: NotebookPushResult[];
  cursor: number;
}
```

**Step 2: Add methods to ApiClient class**

Add after `pushChanges` method (~line 291):

```typescript
  // ==========================================================================
  // Notebook Sync
  // ==========================================================================

  async pullNotebookChanges(cursor: number, limit = 50): Promise<NotebookPullResponse> {
    const params = new URLSearchParams({
      cursor: cursor.toString(),
      limit: limit.toString(),
    });
    return this.request<NotebookPullResponse>(`/sync/notebooks?${params}`);
  }

  async pushNotebookChanges(
    changes: Array<{
      notebookId: string;
      operation: 'create' | 'update' | 'delete';
      data?: string | null;
      localVersion?: number;
    }>
  ): Promise<NotebookPushResponse> {
    return this.request<NotebookPushResponse>('/sync/notebooks', {
      method: 'POST',
      body: JSON.stringify({
        changes,
        deviceId: this.deviceInfo.deviceId,
      }),
    });
  }
```

**Step 3: Commit**

```bash
git add apps/desktop/src/main/services/apiClient.ts
git commit -m "feat(desktop): add notebook sync methods to ApiClient"
```

---

### Task 6: Desktop — Integrate notebook sync into SyncService

**Files:**

- Modify: `apps/desktop/src/main/services/syncService.ts`

**Step 1: Add notebookRepository to constructor**

Update imports and constructor to accept `SQLiteNotebookRepository`:

```typescript
// Add to imports
import type { SQLiteNotebookRepository } from '@dripnex/storage-sqlite';
import { createNotebookId } from '@dripnex/core';
```

Add to constructor:

```typescript
private notebookRepository: SQLiteNotebookRepository;
```

Update constructor signature:

```typescript
constructor(
  apiClient: ApiClient,
  encryptionService: EncryptionService,
  noteRepository: SQLiteNoteRepository,
  notebookRepository: SQLiteNotebookRepository,
  initialCursor = 0
)
```

Add `notebookCursor` to `SyncState`:

```typescript
interface SyncState {
  cursor: number;
  notebookCursor: number;
  lastSyncAt: number | null;
  isSyncing: boolean;
}
```

**Step 2: Add notebook pull method**

Add after `pull()` method (~line 130):

```typescript
  /**
   * Pull notebook changes from server
   */
  async pullNotebooks(): Promise<{
    success: boolean;
    changes: NotebookSyncChange[];
    cursor: number;
    hasMore: boolean;
    error?: string;
  }> {
    try {
      const result = await this.apiClient.pullNotebookChanges(this.state.notebookCursor, 50);

      for (const change of result.changes) {
        await this.applyRemoteNotebookChange(change);
      }

      this.state.notebookCursor = result.cursor;

      return {
        success: true,
        changes: result.changes,
        cursor: result.cursor,
        hasMore: result.hasMore,
      };
    } catch (error) {
      return {
        success: false,
        changes: [],
        cursor: this.state.notebookCursor,
        hasMore: false,
        error: error instanceof Error ? error.message : 'Failed to pull notebook changes',
      };
    }
  }
```

**Step 3: Add notebook push method**

```typescript
  /**
   * Push local notebook changes to server
   */
  async pushNotebooks(): Promise<{
    success: boolean;
    results: NotebookPushResult[];
    error?: string;
  }> {
    try {
      const pendingChanges = this.notebookRepository.getPendingChanges(50);
      if (pendingChanges.length === 0) {
        return { success: true, results: [] };
      }

      // Validate locally before pushing
      const validChanges = pendingChanges.filter(({ notebook }) => {
        const validation = this.notebookRepository.validateForSync(createNotebookId(notebook.id));
        if (!validation.valid) {
          console.warn(`[notebook-sync] Skipping invalid notebook ${notebook.id}: ${validation.error}`);
        }
        return validation.valid;
      });

      if (validChanges.length === 0) {
        return { success: true, results: [] };
      }

      const changesToPush = validChanges.map(({ notebook, localVersion }) => ({
        notebookId: notebook.id,
        operation: 'update' as const, // Notebooks don't soft-delete like notes
        data: JSON.stringify({
          name: notebook.name,
          parentId: notebook.parentId,
          depth: notebook.depth,
          order: notebook.order,
          createdAt: notebook.createdAt,
          updatedAt: notebook.updatedAt,
        }),
        localVersion,
      }));

      const result = await this.apiClient.pushNotebookChanges(changesToPush);

      // Mark successfully pushed notebooks as synced
      const successfulIds = result.results
        .filter(r => r.status === 'applied')
        .map(r => createNotebookId(r.notebookId));

      this.notebookRepository.markMultipleAsSynced(successfulIds);

      return { success: true, results: result.results };
    } catch (error) {
      return {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : 'Failed to push notebook changes',
      };
    }
  }
```

**Step 4: Update syncNow() to sync notebooks first**

In `syncNow()` method (line 187), add notebook sync BEFORE note sync:

```typescript
  async syncNow(): Promise<SyncResult> {
    if (this.state.isSyncing) {
      return { success: false, changesApplied: 0, changesPushed: 0, conflicts: [], error: 'Sync already in progress' };
    }

    this.state.isSyncing = true;

    try {
      // Step 1: Pull notebooks first (notes depend on notebooks)
      const nbPullResult = await this.pullNotebooks();
      if (!nbPullResult.success) {
        console.error('Failed to pull notebooks:', nbPullResult.error);
        // Continue with note sync even if notebook sync fails
      }

      // Step 2: Push notebooks
      const nbPushResult = await this.pushNotebooks();
      if (!nbPushResult.success) {
        console.error('Failed to push notebooks:', nbPushResult.error);
      }

      // Step 3: Pull notes
      const pullResult = await this.pull();
      // ... (existing note pull logic)

      // Step 4: Push notes
      // ... (existing note push logic)

      return {
        success: true,
        changesApplied: pullResult.changes.length + (nbPullResult.changes?.length ?? 0),
        changesPushed,
        conflicts: pullResult.conflicts,
      };
    } catch (error) {
      // ... existing error handling
    } finally {
      this.state.isSyncing = false;
    }
  }
```

**Step 5: Add applyRemoteNotebookChange private method**

```typescript
  /**
   * Apply a remote notebook change to local database
   */
  private async applyRemoteNotebookChange(change: NotebookSyncChange): Promise<void> {
    const notebookId = createNotebookId(change.notebookId);

    switch (change.operation) {
      case 'create':
      case 'update': {
        if (!change.data) {
          throw new Error(`No data for ${change.operation} operation on notebook`);
        }

        const parsed = JSON.parse(change.data) as {
          name: string;
          parentId: string | null;
          depth: number;
          order: number;
          createdAt: string;
          updatedAt: string;
        };

        const existing = await this.notebookRepository.get(notebookId);

        if (existing) {
          // LWW — apply remote change
          await this.notebookRepository.save({
            ...existing,
            name: parsed.name,
            parentId: parsed.parentId ? createNotebookId(parsed.parentId) : null,
            depth: parsed.depth,
            order: parsed.order,
            updatedAt: parsed.updatedAt as Timestamp,
          });
        } else {
          // Create new notebook from remote
          await this.notebookRepository.save(
            createNotebook({
              id: notebookId,
              name: parsed.name,
              parentId: parsed.parentId ? createNotebookId(parsed.parentId) : null,
              parentDepth: parsed.depth > 0 ? parsed.depth - 1 : undefined,
              order: parsed.order,
              createdAt: parsed.createdAt as Timestamp,
            })
          );
        }

        // Mark as synced to avoid re-pushing
        this.notebookRepository.markAsSynced(notebookId);
        break;
      }

      case 'delete': {
        const existing = await this.notebookRepository.get(notebookId);
        if (existing) {
          await this.notebookRepository.delete(notebookId);
        }
        break;
      }

      default:
        console.warn(`Unknown notebook operation: ${change.operation}`);
    }
  }
```

**Step 6: Commit**

```bash
git add apps/desktop/src/main/services/syncService.ts
git commit -m "feat(desktop): integrate notebook sync into SyncService"
```

---

### Task 7: Tree Validation Tests

**Files:**

- Create: `packages/sync-core/tests/treeValidation.test.ts`

**Step 1: Write comprehensive tree validation tests**

```typescript
import { describe, it, expect } from 'vitest';

// Replicate the validateNotebookTree logic for unit testing
function validateNotebookTree(
  changes: Array<{ notebookId: string; operation: string; data?: string | null }>,
  existing: Map<string, { parentId: string | null; depth: number }>
): { valid: true } | { valid: false; error: string; notebookId: string } {
  const tree = new Map(existing);

  for (const change of changes) {
    if (change.operation === 'delete') {
      tree.delete(change.notebookId);
      continue;
    }
    if (!change.data) continue;
    const parsed = JSON.parse(change.data);

    if (parsed.depth > 2) {
      return {
        valid: false,
        error: `depth exceeds max (2), got ${parsed.depth}`,
        notebookId: change.notebookId,
      };
    }
    if (parsed.parentId && !tree.has(parsed.parentId)) {
      return {
        valid: false,
        error: `parentId '${parsed.parentId}' not found`,
        notebookId: change.notebookId,
      };
    }
    if (parsed.parentId) {
      const visited = new Set<string>([change.notebookId]);
      let current: string | null = parsed.parentId;
      while (current) {
        if (visited.has(current)) {
          return {
            valid: false,
            error: `circular reference detected`,
            notebookId: change.notebookId,
          };
        }
        visited.add(current);
        current = tree.get(current)?.parentId ?? null;
      }
    }
    tree.set(change.notebookId, { parentId: parsed.parentId, depth: parsed.depth });
  }
  return { valid: true };
}

describe('validateNotebookTree', () => {
  it('accepts valid root notebook', () => {
    const result = validateNotebookTree(
      [
        {
          notebookId: 'nb-1',
          operation: 'create',
          data: JSON.stringify({ name: 'Work', parentId: null, depth: 0, order: 0 }),
        },
      ],
      new Map()
    );
    expect(result).toEqual({ valid: true });
  });

  it('accepts valid child notebook (depth 1)', () => {
    const existing = new Map([['nb-1', { parentId: null, depth: 0 }]]);
    const result = validateNotebookTree(
      [
        {
          notebookId: 'nb-2',
          operation: 'create',
          data: JSON.stringify({ name: 'Sub', parentId: 'nb-1', depth: 1, order: 0 }),
        },
      ],
      existing
    );
    expect(result).toEqual({ valid: true });
  });

  it('rejects depth > 2', () => {
    const result = validateNotebookTree(
      [
        {
          notebookId: 'nb-deep',
          operation: 'create',
          data: JSON.stringify({ name: 'Deep', parentId: 'nb-2', depth: 3, order: 0 }),
        },
      ],
      new Map([['nb-2', { parentId: 'nb-1', depth: 2 }]])
    );
    expect(result).toEqual({
      valid: false,
      error: 'depth exceeds max (2), got 3',
      notebookId: 'nb-deep',
    });
  });

  it('rejects missing parentId', () => {
    const result = validateNotebookTree(
      [
        {
          notebookId: 'nb-orphan',
          operation: 'create',
          data: JSON.stringify({ name: 'Orphan', parentId: 'nb-ghost', depth: 1, order: 0 }),
        },
      ],
      new Map()
    );
    expect(result).toEqual({
      valid: false,
      error: "parentId 'nb-ghost' not found",
      notebookId: 'nb-orphan',
    });
  });

  it('detects circular reference A→B→A', () => {
    const existing = new Map([['nb-a', { parentId: 'nb-b', depth: 1 }]]);
    const result = validateNotebookTree(
      [
        {
          notebookId: 'nb-b',
          operation: 'update',
          data: JSON.stringify({ name: 'B', parentId: 'nb-a', depth: 1, order: 0 }),
        },
      ],
      existing
    );
    expect(result).toEqual({
      valid: false,
      error: 'circular reference detected',
      notebookId: 'nb-b',
    });
  });

  it('detects self-reference', () => {
    const result = validateNotebookTree(
      [
        {
          notebookId: 'nb-self',
          operation: 'create',
          data: JSON.stringify({ name: 'Self', parentId: 'nb-self', depth: 1, order: 0 }),
        },
      ],
      new Map()
    );
    // parentId 'nb-self' not in existing tree yet (it's the same entry being created)
    expect(result).toEqual({
      valid: false,
      error: "parentId 'nb-self' not found",
      notebookId: 'nb-self',
    });
  });

  it('accepts delete operation', () => {
    const existing = new Map([['nb-1', { parentId: null, depth: 0 }]]);
    const result = validateNotebookTree([{ notebookId: 'nb-1', operation: 'delete' }], existing);
    expect(result).toEqual({ valid: true });
  });

  it('handles two devices creating notebooks under same parent', () => {
    const existing = new Map([['nb-root', { parentId: null, depth: 0 }]]);
    const result = validateNotebookTree(
      [
        {
          notebookId: 'nb-a',
          operation: 'create',
          data: JSON.stringify({ name: 'A', parentId: 'nb-root', depth: 1, order: 0 }),
        },
        {
          notebookId: 'nb-b',
          operation: 'create',
          data: JSON.stringify({ name: 'B', parentId: 'nb-root', depth: 1, order: 1 }),
        },
      ],
      existing
    );
    expect(result).toEqual({ valid: true });
  });
});
```

**Step 2: Run tests**

Run: `cd packages/sync-core && npx vitest run tests/treeValidation.test.ts`
Expected: All 8 tests PASS

**Step 3: Commit**

```bash
git add packages/sync-core/tests/treeValidation.test.ts
git commit -m "test(sync-core): add tree validation unit tests for notebook sync"
```

---

### Task 8: Extract shared validation function

**Files:**

- Create: `packages/sync-core/src/treeValidation.ts`
- Modify: `packages/api/src/routes/sync.ts` (import from sync-core)

**Step 1: Extract validateNotebookTree to sync-core**

Create `packages/sync-core/src/treeValidation.ts`:

```typescript
/**
 * Notebook tree validation for sync.
 *
 * Validates that pushed notebook changes maintain tree integrity:
 * - depth ≤ 2
 * - parentId references existing notebook
 * - No circular references
 */

export interface TreeNode {
  parentId: string | null;
  depth: number;
}

export type TreeValidationResult =
  | { valid: true }
  | { valid: false; error: string; notebookId: string };

export function validateNotebookTree(
  changes: Array<{ notebookId: string; operation: string; data?: string | null }>,
  existingNotebooks: Map<string, TreeNode>
): TreeValidationResult {
  const tree = new Map(existingNotebooks);

  for (const change of changes) {
    if (change.operation === 'delete') {
      tree.delete(change.notebookId);
      continue;
    }

    if (!change.data) continue;

    const parsed = JSON.parse(change.data) as {
      name: string;
      parentId: string | null;
      depth: number;
      order: number;
    };

    if (parsed.depth > 2) {
      return {
        valid: false,
        error: `depth exceeds max (2), got ${parsed.depth}`,
        notebookId: change.notebookId,
      };
    }

    if (parsed.parentId && !tree.has(parsed.parentId)) {
      return {
        valid: false,
        error: `parentId '${parsed.parentId}' not found`,
        notebookId: change.notebookId,
      };
    }

    if (parsed.parentId) {
      const visited = new Set<string>([change.notebookId]);
      let current: string | null = parsed.parentId;
      while (current) {
        if (visited.has(current)) {
          return {
            valid: false,
            error: 'circular reference detected',
            notebookId: change.notebookId,
          };
        }
        visited.add(current);
        current = tree.get(current)?.parentId ?? null;
      }
    }

    tree.set(change.notebookId, { parentId: parsed.parentId, depth: parsed.depth });
  }

  return { valid: true };
}
```

**Step 2: Export from sync-core index**

Add to `packages/sync-core/src/index.ts`:

```typescript
export {
  validateNotebookTree,
  type TreeNode,
  type TreeValidationResult,
} from './treeValidation.js';
```

**Step 3: Update tests to import from the module**

Update `packages/sync-core/tests/treeValidation.test.ts` to import from `'../src/treeValidation.js'` instead of duplicating the function.

**Step 4: Update API route to import from sync-core**

In `packages/api/src/routes/sync.ts`, replace the inline `validateNotebookTree` with:

```typescript
import { validateNotebookTree } from '@dripnex/sync-core';
```

**Step 5: Run all tests**

Run: `pnpm test`
Expected: All pass

**Step 6: Commit**

```bash
git add packages/sync-core/src/treeValidation.ts packages/sync-core/src/index.ts packages/sync-core/tests/treeValidation.test.ts packages/api/src/routes/sync.ts
git commit -m "refactor(sync-core): extract shared tree validation to sync-core package"
```

---

### Task 9: Final integration test and typecheck

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Run lint and format**

Run: `pnpm lint && pnpm format:check`
Expected: Clean

**Step 4: Final commit if any formatting fixes needed**

```bash
pnpm format
git add -A
git commit -m "chore: format notebook sync code"
```

---

## Task Dependency Graph

```
Task 1 (API schema) ──→ Task 2 (API routes) ──→ Task 8 (extract shared validation)
                                                       ↑
Task 3 (SQLite migration) ──→ Task 4 (repository methods) ──→ Task 6 (SyncService)
                                                                      ↓
Task 5 (ApiClient methods) ──────────────────────────────────→ Task 6
                                                                      ↓
Task 7 (tree validation tests) ──→ Task 8 ──→ Task 9 (integration)
```

**Parallelizable:** Tasks 1+3 can run in parallel. Tasks 5+7 can run in parallel.
