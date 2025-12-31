# Core Package

`@readied/core` contains all domain logic for Readied.

## Principles

- **Zero dependencies** on Electron, React, or Node-specific APIs
- **Testable** in pure Node.js
- **Pure functions** where possible

## Structure

```
packages/core/
├── domain/
│   ├── note.ts          # Note entity
│   ├── metadata.ts      # NoteMetadata
│   ├── types.ts         # NoteId, Timestamp, Tag
│   └── invariants.ts    # Business rules
├── operations/
│   ├── createNote.ts
│   ├── updateNote.ts
│   ├── deleteNote.ts
│   ├── archiveNote.ts
│   └── ...
├── contracts/
│   ├── NoteInput.ts     # Input types
│   ├── NoteSnapshot.ts  # Output types
│   └── CoreResult.ts    # Result wrapper
├── repositories/
│   └── NoteRepository.ts # Interface only
└── validation/
    └── schemas.ts       # Zod schemas
```

## Note Entity

```typescript
interface Note {
  readonly id: NoteId;
  readonly content: string; // Raw markdown
  readonly metadata: NoteMetadata; // Derived data
}

interface NoteMetadata {
  readonly title: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly tags: readonly Tag[];
  readonly wordCount: number;
  readonly archivedAt: Timestamp | null;
}
```

## Operations

Operations are pure functions that take input and a repository:

```typescript
// createNote.ts
export async function createNoteOperation(
  input: CreateNoteInput,
  repo: NoteRepository
): Promise<Result<NoteSnapshot>> {
  // Validate input
  // Create Note entity
  // Save via repository
  // Return snapshot
}
```

## Repository Interface

Core defines the interface, storage packages implement it:

```typescript
interface NoteRepository {
  get(id: NoteId): Promise<Note | null>;
  save(note: Note): Promise<void>;
  delete(id: NoteId): Promise<void>;
  list(options?: ListOptions): Promise<Note[]>;
  search(term: string): Promise<Note[]>;
}
```

## Testing

```bash
pnpm --filter @readied/core test
```

52 tests covering all domain logic.
