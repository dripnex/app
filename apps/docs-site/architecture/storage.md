# Storage

Storage is split into multiple packages for isolation of native dependencies and separation of concerns.

## Packages

### @readied/storage-core

Interfaces and utilities with **no native dependencies**:

- `DatabaseAdapter` interface
- `Migration` types and runner
- `DataPaths` management
- Backup system
- Export/Import utilities

### @readied/storage-sqlite

SQLite implementation using `better-sqlite3`:

- `DatabaseConnection` adapter
- `SQLiteNoteRepository`
- `SQLiteNotebookRepository`
- `SQLiteTagRepository`
- Migration definitions
- **Only package with native deps**

### @readied/sync-core

Supabase-based sync engine:

- Push/pull operations against remote storage
- Sync state tracking (last synced timestamps, dirty flags)
- Conflict resolution strategy
- Authentication integration (login/logout)

## Why Split?

Native modules (like better-sqlite3) cause issues:

- Need rebuilding for each Electron version
- Platform-specific binaries
- Can't run in pure Node without native compilation

By isolating native deps to `storage-sqlite`, we can:

- Test storage-core anywhere
- Swap implementations if needed
- Keep clean dependency graph

## Database Adapter

```typescript
interface DatabaseAdapter {
  run(sql: string): void;
  prepare<T>(sql: string): PreparedStatement<T>;
  transaction<T>(fn: () => T): T;
  close(): void;
  get isOpen(): boolean;
}
```

## Repositories

The storage layer exposes multiple repository interfaces:

| Repository             | Purpose                     |
| ---------------------- | --------------------------- |
| `NoteRepository`       | CRUD for notes              |
| `NotebookRepository`   | Notebook hierarchy          |
| `TagRepository`        | Tag management              |

Each repository interface is defined in `storage-core` and implemented in `storage-sqlite`.

## Migrations

Forward-only migrations run on startup:

```typescript
const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: `CREATE TABLE notes (...)`,
  },
  // Later migrations add:
  // - notebooks table and note-notebook relationships
  // - tags table
  // - sync state tables (sync_log, sync_metadata)
  // - indexes for performance
];

// Run pending migrations
runMigrations(db, migrations);
```

The migration system has grown to include tables for notebooks, tags, and sync state alongside the original notes schema.

## Sync Storage

The `@readied/sync-core` package adds a sync layer on top of local storage:

1. **Local-first** - All writes go to SQLite first
2. **Sync state tracking** - Each record tracks its sync status (synced, dirty, conflict)
3. **Push** - Dirty records are pushed to Supabase
4. **Pull** - Remote changes are pulled and merged locally
5. **Conflict resolution** - Last-write-wins with optional manual resolution

Sync state tables track:

- Last successful sync timestamp per entity type
- Per-record dirty flags
- Conflict markers for manual resolution

## Backup System

```typescript
// Create backup
createBackup({
  backupDir: paths.backups,
  databasePath: paths.database,
});

// List backups
const backups = listBackups(paths.backups);

// Restore
restoreBackup(backupPath, databasePath);
```

## Export/Import

See [Data Management](/guide/getting-started#import--export).
