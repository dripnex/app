/**
 * NoteRepository over node:sqlite.
 *
 * MCP cannot import better-sqlite3 (Electron ABI). Writes still go through
 * @dripnex/core operations so title / updatedAt / trash match the desktop.
 */

import type { Note, NoteId, NoteRepository, NoteStatus, Tag } from '@dripnex/core';
import {
  createNote,
  createNoteId,
  createNotebookId,
  createTag,
  DEFAULT_NOTE_STATUS,
} from '@dripnex/core';
import type { Database } from './db.js';

interface NoteRow {
  id: string;
  notebook_id: string;
  content: string;
  title: string;
  created_at: string;
  updated_at: string;
  word_count: number;
  archived_at: string | null;
  is_pinned: number;
  is_deleted: number;
  status: string;
}

export class NodeSqliteNoteRepository implements NoteRepository {
  constructor(private readonly db: Database) {}

  async get(id: NoteId): Promise<Note | null> {
    const row = this.db
      .prepare(
        `SELECT id, notebook_id, content, title, created_at, updated_at, word_count,
                archived_at, is_pinned, is_deleted, status
           FROM notes WHERE id = ?`
      )
      .get(id) as NoteRow | undefined;
    if (!row) return null;
    return rowToNote(row, this.tagsFor(id));
  }

  async save(note: Note): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO notes (id, notebook_id, content, title, created_at, updated_at, word_count, archived_at,
                            is_pinned, is_deleted, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           notebook_id = excluded.notebook_id,
           content = excluded.content,
           title = excluded.title,
           updated_at = excluded.updated_at,
           word_count = excluded.word_count,
           archived_at = excluded.archived_at,
           is_pinned = excluded.is_pinned,
           is_deleted = excluded.is_deleted,
           status = excluded.status`
      )
      .run(
        note.id,
        note.notebookId,
        note.content,
        note.title,
        note.metadata.createdAt,
        note.metadata.updatedAt,
        note.metadata.wordCount,
        note.metadata.archivedAt,
        note.isPinned ? 1 : 0,
        note.isDeleted ? 1 : 0,
        note.status
      );
  }

  async delete(id: NoteId): Promise<void> {
    this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  }

  findNotebookIdByName(name: string): string | null {
    const row = this.db.prepare('SELECT id FROM notebooks WHERE name = ? LIMIT 1').get(name) as
      | { id: string }
      | undefined;
    return row?.id ?? null;
  }

  private tagsFor(noteId: string): Tag[] {
    try {
      const rows = this.db
        .prepare(
          `SELECT t.name FROM note_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.note_id = ?`
        )
        .all(noteId) as Array<{ name: string }>;
      return rows.map(r => createTag(r.name));
    } catch {
      return [];
    }
  }
}

function rowToNote(row: NoteRow, tags: Tag[]): Note {
  const note = createNote({
    id: createNoteId(row.id),
    notebookId: createNotebookId(row.notebook_id),
    title: row.title,
    content: row.content,
    createdAt: row.created_at as Note['metadata']['createdAt'],
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
      createdAt: row.created_at as Note['metadata']['createdAt'],
      updatedAt: row.updated_at as Note['metadata']['updatedAt'],
      tags,
      wordCount: row.word_count,
      archivedAt: row.archived_at as Note['metadata']['archivedAt'],
    },
  };
}
