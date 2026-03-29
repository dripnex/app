# Notebook Sync Design

> Approved 2026-03-11. Phase 1 of entity sync expansion (notebooks first, tags second).

## Decisions

| Decision       | Choice                                           | Rationale                                                          |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| Conflict model | Hybrid (entity-level + server tree validation)   | Entity-level for flexibility, server validation for tree integrity |
| Tag identity   | Dual-key (UUID for sync, dedup by name)          | Robust protocol + intuitive UX (same name = same tag)              |
| Tag sync scope | Manual tags + colors only                        | Auto-extracted regenerate locally from markdown                    |
| Rollout order  | Notebooks first, tags second                     | Notebooks have 60% infra ready; validate pattern then replicate    |
| Architecture   | Extend existing pattern (no generic abstraction) | YAGNI — replicate note sync, evaluate abstraction after tags       |
| Encryption     | None for notebooks                               | Metadata only (names, structure), not user content                 |

## Data Flow

```
Device A (offline)                    Server                     Device B
─────────────────                    ──────                     ─────────
Create/edit notebook
  → SQLite trigger → sync_queue
  → queueChange('notebook', id)

          ── PUSH /api/sync/notebooks ──→
          { changes: [SyncableNotebook], cursor }

                              Validate tree:
                              - depth ≤ 2
                              - parentId exists
                              - no cycles (visited set, O(n))
                              Store + bump cursor

                              ←── PULL /api/sync/notebooks ──
                              { changes: [...], newCursor }

                                                    Apply locally
                                                    Conflict → LWW (updatedAt + deviceId)
```

## Migration 012: Notebook Sync Triggers

```sql
CREATE TRIGGER IF NOT EXISTS notebook_sync_after_update
AFTER UPDATE ON notebooks
WHEN NEW.updatedAt != OLD.updatedAt
BEGIN
  INSERT OR REPLACE INTO sync_queue (entity_type, entity_id, action, queued_at)
  VALUES ('notebook', NEW.id, 'upsert', datetime('now'));
END;

CREATE TRIGGER IF NOT EXISTS notebook_sync_after_insert
AFTER INSERT ON notebooks
BEGIN
  INSERT INTO sync_queue (entity_type, entity_id, action, queued_at)
  VALUES ('notebook', NEW.id, 'upsert', datetime('now'));
END;

CREATE TRIGGER IF NOT EXISTS notebook_sync_after_delete
AFTER DELETE ON notebooks
BEGIN
  INSERT INTO sync_queue (entity_type, entity_id, action, queued_at)
  VALUES ('notebook', OLD.id, 'delete', datetime('now'));
END;
```

Also add unique constraint to sync_queue:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_queue_entity
ON sync_queue (entity_type, entity_id);
```

## Backend API

Two new endpoints in `packages/api/src/routes/sync.ts`:

- `POST /api/sync/notebooks` — Push with tree validation middleware
- `GET /api/sync/notebooks` — Pull cursor-based

Tree validation rejects with `422 Unprocessable Entity` + `{ notebookId, error }`.

### Tree Validation Rules

1. `depth ≤ 2`
2. `parentId` references existing notebook or is `null`
3. No cycles — walk parentId chain with visited set (O(n))

### Orphan Handling

When a parent notebook is deleted and sub-notebooks exist on another device:

- Server reparents orphans to root (`parentId = null, depth = 0`)
- Log warning for monitoring

## Sync Client

Implement `pushNotebooks()` and `pullNotebooks()` in `packages/sync-core/src/client.ts`.

Push body fields: `id, name, parentId, depth, order, createdAt, updatedAt, deviceId, version, syncCursor, deleted`.

## Sync Service

In `apps/desktop/src/main/services/syncService.ts`:

- Add `syncNotebooks()` to sync cycle
- **Order: notebooks first, notes second** (notes reference notebooks)
- Local pre-push validation: depth ≤ 2 and parentId valid before enqueuing
- Invalid local changes → feedback in sidebar, not enqueued

## Error Handling

| Scenario              | Behavior                                        |
| --------------------- | ----------------------------------------------- |
| Push rejected (422)   | Remove from sync_queue, log + toast with reason |
| Orphan sub-notebooks  | Server reparents to root, log warning           |
| Network failure       | Retry with exponential backoff (existing)       |
| Local validation fail | Don't enqueue, inline feedback                  |
| Sync queue duplicate  | `UNIQUE(entity_type, entity_id)` constraint     |
| Max retries (3)       | Mark `failed` in queue, notify user             |

## Testing

### Unit Tests

- `packages/sync-core/__tests__/notebookSync.test.ts` — push/pull serialization
- `packages/sync-core/__tests__/treeValidation.test.ts` — depth, cycles, orphans

### Integration Tests

- `packages/api/__tests__/syncNotebooks.test.ts` — endpoints + validation
- `apps/desktop/__tests__/syncService.test.ts` — queue + sync cycle order

### Critical Test Cases

1. Push depth > 2 → 422
2. Push circular parentId → 422
3. Delete parent → children reparented to root
4. Two devices create notebooks offline → both preserved
5. Sync order: notebooks before notes
6. Local validation prevents invalid push
7. Retry max 3 → failed + notification

## Future: Tag Sync (Phase 2)

After notebook sync is validated:

1. Add `uuid` column to tags table (migration 013)
2. Add sync fields to tags (`syncCursor`, `deviceId`, `version`, `deleted`)
3. Sync manual tags + colors only; auto-extracted regenerate locally
4. Dedup by name on server (same name = merge, keep oldest UUID)
5. Replicate notebook sync pattern for endpoints and client
