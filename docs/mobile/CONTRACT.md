# Mobile contract

Canonical types live in `dripnex/app`. iOS copies these fields. Do not invent new ones.

| Source                                                                                             | What iOS copies                                            |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`packages/core/src/contracts/NoteSnapshot.ts`](../../packages/core/src/contracts/NoteSnapshot.ts) | Note shape that leaves core (IPC / UI / storage)           |
| [`packages/core/src/domain/types.ts`](../../packages/core/src/domain/types.ts)                     | `NoteStatus`, `INBOX_NOTEBOOK_ID`, `TEMPLATES_NOTEBOOK_ID` |
| [`packages/sync-core/src/types.ts`](../../packages/sync-core/src/types.ts)                         | Zod wire schemas for push / pull                           |

Plan: [PLAN.md](./PLAN.md). Decision: [ADR 005](../adr/005-mobile-own-repo.md).

## NoteSnapshot

From `packages/core/src/contracts/NoteSnapshot.ts`. Plain serializable fields (no branded ids).

| Field              | Type             |
| ------------------ | ---------------- |
| `id`               | `string`         |
| `notebookId`       | `string`         |
| `content`          | `string`         |
| `title`            | `string`         |
| `createdAt`        | `string`         |
| `updatedAt`        | `string`         |
| `tags`             | `string[]`       |
| `wordCount`        | `number`         |
| `taskCount`        | `number`         |
| `checkedTaskCount` | `number`         |
| `archivedAt`       | `string \| null` |
| `isArchived`       | `boolean`        |
| `isPinned`         | `boolean`        |
| `isDeleted`        | `boolean`        |
| `status`           | `NoteStatus`     |

`NoteSummary` in the same file is the list-row subset (no `content`; adds `excerpt`). Same identity and status fields. Do not add a second note model.

## Domain constants

From `packages/core/src/domain/types.ts`:

| Name                    | Value                                               |
| ----------------------- | --------------------------------------------------- |
| `NoteStatus`            | `'active' \| 'on_hold' \| 'completed' \| 'dropped'` |
| `NOTE_STATUSES`         | the four values above                               |
| `DEFAULT_NOTE_STATUS`   | `'active'`                                          |
| `INBOX_NOTEBOOK_ID`     | `'inbox'`                                           |
| `TEMPLATES_NOTEBOOK_ID` | `'templates'`                                       |
| `MAX_NOTEBOOK_DEPTH`    | `2` (levels 0, 1, 2)                                |

Inbox is the default notebook. Templates is reserved. Do not invent other reserved ids.

## Sync wire (Zod)

From `packages/sync-core/src/types.ts`. These schemas are the live wire. iOS must send and accept the same keys.

`NoteOperationSchema`: `'create' | 'update' | 'delete'`.

**LocalNotePushSchema** (plaintext content, renderer → main):

| Field          | Rule                                 |
| -------------- | ------------------------------------ |
| `noteId`       | `string`, min 1, max 128             |
| `operation`    | `NoteOperationSchema`                |
| `content`      | `string`, max 10 MiB, optional       |
| `localVersion` | `number`, int, nonnegative, optional |

**EncryptedNotePushSchema** (content already encrypted, main → API):

| Field           | Rule                       |
| --------------- | -------------------------- |
| `noteId`        | `string`, min 1, max 128   |
| `operation`     | `NoteOperationSchema`      |
| `encryptedData` | `string \| null`, optional |
| `localVersion`  | `number`, int, optional    |

**EncryptedNotePushRequestSchema**: `changes` (1–100 `EncryptedNotePushSchema`), `deviceId` (UUID string).

**RemoteNoteChangeSchema** (API → client pull item):

| Field           | Type                  |
| --------------- | --------------------- |
| `id`            | `string`              |
| `noteId`        | `string`              |
| `version`       | `number` (int)        |
| `operation`     | `NoteOperationSchema` |
| `encryptedData` | `string \| null`      |
| `deviceId`      | `string`              |
| `createdAt`     | `string`              |

**NotePushResultSchema**: `noteId`, `version` (int), `status` (`'applied' | 'conflict'`), optional `serverVersion` (int).

**NotePushResponseSchema**: `results` (`NotePushResultSchema[]`), `cursor` (int).

**NotePullResponseSchema**: `changes` (`RemoteNoteChangeSchema[]`), `cursor` (int), `hasMore` (boolean).

TypeScript names (`LocalNotePush`, `EncryptedNotePush`, …) are `z.infer` of those schemas. Copy the fields, not new ones.

## Rules

- Markdown is the note body (`content`). Do not persist a second AST or rich-text format.
- Same account / AuthGate as desktop. Sync is `api.dripnex.app` after login.
- If a field is not in these files, it is not in the contract.
