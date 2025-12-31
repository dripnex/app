# Storage

Storage is split into two packages for isolation of native dependencies.

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
- Migration definitions

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
  exec(sql: string): void;
  prepare<T>(sql: string): PreparedStatement<T>;
  transaction<T>(fn: () => T): T;
  close(): void;
  get isOpen(): boolean;
}
```

## Migrations

Forward-only migrations run on startup:

```typescript
const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: `CREATE TABLE notes (...)`,
  },
];

// Run pending migrations
runMigrations(db, migrations);
```

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
