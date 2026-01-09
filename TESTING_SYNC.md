# Multi-Device Sync Testing Guide

**Status:** Semana 2, Sprint 1 - Ready for Testing
**Date:** 2026-01-09
**Feature:** Bidirectional sync with local change tracking

---

## Prerequisites

1. ✅ Backend API deployed to staging (`api-staging.readied.app`)
2. ✅ Migration 008 (sync tracking) ready
3. ✅ Desktop app with sync service changes
4. ⚠️ Two test accounts or two devices to simulate multi-device

---

## Test Scenarios

### Scenario 1: Basic Push/Pull (Happy Path)

**Goal:** Verify note created on Device A syncs to Device B

**Steps:**

1. **Device A:**
   - Launch app, sign in with test account
   - Create new note: "Test Sync Note"
   - Edit content: "This is a test note created on Device A"
   - Wait 5 minutes for auto-sync OR trigger manual sync

2. **Verify Server:**
   - Check sync_log table in Turso:
     ```sql
     SELECT * FROM sync_log WHERE user_id = 'test-user-id' ORDER BY version DESC LIMIT 5;
     ```
   - Should see encrypted_data for the new note

3. **Device B:**
   - Launch app, sign in with same test account
   - Trigger manual sync
   - Verify "Test Sync Note" appears in note list
   - Open note, verify content matches

**Expected Result:** ✅ Note syncs correctly, content decrypts properly

**Failure Modes:**
- ❌ Note marked needs_sync=1 but not pushed → Check push logic
- ❌ Note pushed but not appearing on B → Check pull logic
- ❌ Content garbled → Check encryption/decryption

---

### Scenario 2: Edit Conflict (Different Devices, Offline)

**Goal:** Detect and resolve conflicts when same note edited offline on both devices

**Steps:**

1. **Device A (online):**
   - Create note: "Conflict Test"
   - Content: "Original content"
   - Wait for sync

2. **Device B (online):**
   - Pull changes, verify note exists
   - **Go offline** (disable network)

3. **Device A (online):**
   - Edit note: "Content edited on Device A"
   - Wait for sync (should push successfully)

4. **Device B (offline):**
   - Edit same note: "Content edited on Device B"
   - Note marked needs_sync=1 locally
   - **Go online**

5. **Device B (online):**
   - Trigger sync
   - **CONFLICT DETECTED:**
     - Push attempt returns status='conflict'
     - Note remains needs_sync=1
     - User sees conflict in UI

6. **Device B - Resolution:**
   - Choose "Keep Local" → resetSyncTracking() → push again
   - OR choose "Keep Remote" → markAsSynced() → accept server version

**Expected Result:**
- ✅ Conflict detected during push
- ✅ User can resolve via UI
- ✅ After resolution, note syncs correctly

**Failure Modes:**
- ❌ Conflict not detected → Check version comparison in backend
- ❌ Resolution doesn't work → Check resolveConflict() implementation
- ❌ Note stuck in conflict state → Check markAsSynced() logic

---

### Scenario 3: Rapid Edits (Stress Test)

**Goal:** Verify sync handles rapid sequential edits without data loss

**Steps:**

1. **Device A:**
   - Create note: "Rapid Edit Test"
   - Edit 10 times rapidly (every 2 seconds)
   - Each edit increments local_version
   - All marked needs_sync=1

2. **Trigger Sync:**
   - syncNow() should batch push up to 50 changes
   - Server processes each change sequentially
   - Mark all as synced after successful push

3. **Device B:**
   - Pull changes
   - Verify final content matches Device A's latest edit
   - Verify local_version reflects all edits

**Expected Result:** ✅ All edits synced, no data loss

**Failure Modes:**
- ❌ Edits lost → Check trigger doesn't skip updates
- ❌ Version mismatch → Check local_version increment
- ❌ Duplicate pushes → Check markAsSynced() called correctly

---

### Scenario 4: Delete Sync

**Goal:** Verify deleted note syncs and removes from other devices

**Steps:**

1. **Device A:**
   - Create note: "Delete Test"
   - Sync (ensure on server)

2. **Device B:**
   - Pull, verify note exists

3. **Device A:**
   - Delete note (soft delete: is_deleted=1)
   - Sync (push delete operation)

4. **Device B:**
   - Pull changes
   - Verify note moved to trash (is_deleted=1)
   - OR hard deleted (removed from DB)

**Expected Result:** ✅ Delete syncs correctly

**Failure Modes:**
- ❌ Note not deleted on B → Check delete operation handling
- ❌ Note re-appears after sync → Check trigger doesn't mark deleted notes

---

## Migration Testing

Before running app, verify migration 008 applies correctly:

```bash
# Check current migrations
sqlite3 ~/Library/Application\ Support/Readied/readied.db "SELECT * FROM migrations ORDER BY version;"

# Apply migration (happens automatically on app launch)
pnpm dev

# Verify new columns exist
sqlite3 ~/Library/Application\ Support/Readied/readied.db \
  "PRAGMA table_info(notes);" | grep -E "(local_version|needs_sync|last_synced_at)"

# Expected output:
# 12|local_version|INTEGER|0|1|0
# 13|needs_sync|INTEGER|0|0|0
# 14|last_synced_at|TEXT|0|NULL|0

# Verify triggers created
sqlite3 ~/Library/Application\ Support/Readied/readied.db \
  "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE '%sync%';"

# Expected output:
# notes_update_sync_tracking
# notes_insert_sync_tracking

# Verify index created
sqlite3 ~/Library/Application\ Support/Readied/readied.db \
  "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%sync%';"

# Expected output:
# idx_notes_needs_sync
```

---

## Manual Sync Trigger (For Testing)

If auto-sync is too slow (5 min interval), trigger manually:

**Option 1: DevTools Console (Renderer)**
```javascript
// Trigger sync
window.api.sync.syncNow();

// Check sync status
window.api.sync.getStatus();
```

**Option 2: Main Process (IPC Handler)**
```typescript
// In main/index.ts
ipcMain.handle('test-sync', async () => {
  const result = await syncService.syncNow();
  console.log('Sync result:', result);
  return result;
});

// Then from renderer:
window.api.invoke('test-sync');
```

**Option 3: Auto-Sync Interval Override**
```typescript
// In main/index.ts, after creating syncService:
syncService.startAutoSync(30 * 1000); // 30 seconds instead of 5 minutes
```

---

## Debug Queries

**Check pending changes locally:**
```sql
SELECT id, title, local_version, needs_sync, last_synced_at
FROM notes
WHERE needs_sync = 1
ORDER BY local_version ASC;
```

**Check sync stats:**
```sql
SELECT
  COUNT(CASE WHEN needs_sync = 1 THEN 1 END) as pending_count,
  MAX(last_synced_at) as last_sync_time
FROM notes;
```

**Check server sync log:**
```sql
-- In Turso staging database
SELECT
  id, note_id, version, operation, device_id, created_at
FROM sync_log
WHERE user_id = 'test-user-id'
ORDER BY version DESC
LIMIT 20;
```

**Check sync cursors:**
```sql
-- In Turso staging database
SELECT
  device_id, last_synced_version, updated_at
FROM sync_cursors
WHERE user_id = 'test-user-id';
```

---

## Expected Behavior

### Triggers

**INSERT:** New note immediately marked needs_sync=1
```sql
INSERT INTO notes (...) VALUES (...);
-- Trigger: notes_insert_sync_tracking fires
-- Result: needs_sync=1
```

**UPDATE (content/title/metadata):**
```sql
UPDATE notes SET content='new content' WHERE id='note-id';
-- Trigger: notes_update_sync_tracking fires
-- Result: needs_sync=1, local_version++
```

**UPDATE (sync-only fields):** Should NOT trigger
```sql
UPDATE notes SET needs_sync=0, last_synced_at='...' WHERE id='note-id';
-- Trigger: Does NOT fire (WHEN clause prevents it)
-- Result: No change to needs_sync or local_version
```

### Sync Flow

1. **User edits note** → Trigger marks needs_sync=1, local_version++
2. **Auto-sync (5 min)** OR manual sync:
   - Pull from server first (get remote changes)
   - Push pending changes (needs_sync=1)
   - Server responds with status='applied' or 'conflict'
   - Mark successful pushes as synced
3. **Other device pulls** → Gets encrypted change, decrypts, applies

---

## Success Criteria

**Scenario 1 (Basic):** ✅ PASS if note created on A appears on B with correct content

**Scenario 2 (Conflict):** ✅ PASS if conflict detected AND user can resolve

**Scenario 3 (Rapid):** ✅ PASS if all 10 edits synced without loss

**Scenario 4 (Delete):** ✅ PASS if deleted note removed/trashed on B

**Performance:** ✅ PASS if sync completes in <5s for 50 notes

---

## Known Issues / Limitations

1. **Conflict Resolution UI:** Not yet implemented
   - Currently logs to console
   - Next task: Build visual diff UI

2. **Large Batches:** Push limited to 50 notes per sync
   - If >50 pending, requires multiple syncs
   - Acceptable for MVP, optimize later

3. **Real-Time Sync:** Auto-sync is 5-min polling
   - Not instant like Inkdrop
   - Next phase: WebSockets for real-time

4. **Migration Rollback:** No automatic rollback
   - If migration 008 fails, manual DB repair needed
   - Pre-migration backups saved automatically

---

## Next Steps After Testing

1. ✅ If tests pass → Commit, move to UI for conflict resolution
2. ⚠️ If tests fail → Debug specific failure mode, fix, re-test
3. 📝 Document actual behavior vs expected in this file
4. 🚀 Deploy to staging for broader testing

---

## Test Log Template

```
Date: ___________
Tester: ___________
Environment: [Staging / Local]

Scenario 1 (Basic): [PASS / FAIL] - Notes: ___________
Scenario 2 (Conflict): [PASS / FAIL] - Notes: ___________
Scenario 3 (Rapid): [PASS / FAIL] - Notes: ___________
Scenario 4 (Delete): [PASS / FAIL] - Notes: ___________

Performance:
- Sync time for 10 notes: _____ ms
- Sync time for 50 notes: _____ ms

Issues Encountered:
- ___________

Overall: [READY FOR PRODUCTION / NEEDS FIXES]
```
