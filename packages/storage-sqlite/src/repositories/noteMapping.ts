/**
 * Row → Note mapping helpers and shared row types.
 *
 * Pure functions extracted from SQLiteNoteRepository so future
 * sync / tag / archive sub-repositories can reuse them without
 * depending on the main repo class.
 */

import {
  type Note,
  type NoteStatus,
  type Tag,
  type Timestamp,
  createNote,
  createNoteId,
  createNotebookId,
  DEFAULT_NOTE_STATUS,
} from '@readied/core';
import type { ArchivedFilter } from '@readied/storage-core';

/** Row shape returned by `SELECT * FROM notes` */
export interface NoteRow {
  id: string;
  notebook_id: string;
  content: string;
  title: string;
  created_at: string;
  updated_at: string;
  word_count: number;
  archived_at: string | null;
  is_pinned: number; // SQLite stores booleans as 0/1
  is_deleted: number;
  status: string;
}

/** Row shape for tag joins (just the tag name) */
export interface TagRow {
  name: string;
}

/** Row shape for tags with their color metadata */
export interface TagWithColorRow {
  name: string;
  color: string | null;
}

/** Backlink information surfaced to the UI */
export interface BacklinkInfo {
  noteId: string;
  noteTitle: string;
  targetRef: string;
}

/**
 * Reconstruct a domain Note from a SQLite row plus its tags.
 *
 * The row carries the *stored* (structural) title — the markdown-derived
 * "display" title lives elsewhere. We reuse `createNote` to get fresh
 * metadata defaults, then overlay the persisted values so that
 * createdAt / updatedAt / wordCount / archivedAt survive the roundtrip.
 */
export function rowToNote(row: NoteRow, tags: Tag[]): Note {
  const note = createNote({
    id: createNoteId(row.id),
    notebookId: createNotebookId(row.notebook_id),
    title: row.title,
    content: row.content,
    createdAt: row.created_at as Timestamp,
    isPinned: row.is_pinned === 1,
    isDeleted: row.is_deleted === 1,
    status: (row.status as NoteStatus) || DEFAULT_NOTE_STATUS,
  });

  return {
    ...note,
    notebookId: createNotebookId(row.notebook_id),
    title: row.title,
    isPinned: row.is_pinned === 1,
    isDeleted: row.is_deleted === 1,
    status: (row.status as NoteStatus) || DEFAULT_NOTE_STATUS,
    metadata: {
      ...note.metadata,
      title: row.title,
      createdAt: row.created_at as Timestamp,
      updatedAt: row.updated_at as Timestamp,
      tags,
      wordCount: row.word_count,
      archivedAt: row.archived_at as Timestamp | null,
    },
  };
}

/**
 * Build an FTS5 MATCH clause from a free-form user query.
 *
 * 1. Strip FTS5 special chars (" * ^ ( )) — we'll add our own.
 * 2. Tokenize on whitespace.
 * 3. Quote each token (defends against tokens that look like FTS keywords)
 *    and append `*` for prefix-matching.
 * 4. Join with OR — any token match counts.
 *
 * Empty / all-whitespace input returns `""`, which FTS5 treats as "no
 * results" rather than throwing.
 */
export function prepareFtsQuery(input: string): string {
  const escaped = input.replace(/["*^()]/g, ' ').trim();
  const terms = escaped.split(/\s+/).filter(t => t.length > 0);
  if (terms.length === 0) return '""';
  return terms.map(t => `"${t}"*`).join(' OR ');
}

/**
 * Build a SQL fragment that filters by archived state.
 *
 * Returns either an empty string (no filter) or a SQL chunk starting
 * with `AND`. Caller is responsible for the WHERE.
 *
 * @param tableAlias prefix without trailing dot, e.g. `n` → emits `n.archived_at`
 */
export function archivedConditionSql(filter: ArchivedFilter, tableAlias: string = ''): string {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  switch (filter) {
    case 'active':
      return `AND ${prefix}archived_at IS NULL`;
    case 'archived':
      return `AND ${prefix}archived_at IS NOT NULL`;
    case 'all':
      return '';
  }
}
