/**
 * NoteRepository over node:sqlite.
 *
 * MCP cannot import better-sqlite3 (Electron ABI). Writes still go through
 * @dripnex/core operations so title / updatedAt / trash match the desktop.
 * save() also writes content tags and chunks, same as the desktop repo.
 */

import { createHash } from 'node:crypto';
import type { Note, NoteId, NoteRepository, NoteStatus, Tag } from '@dripnex/core';
import {
  chunkMarkdown,
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
    this.db.exec('BEGIN IMMEDIATE');
    try {
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
      this.syncExtractedTags(note.id, note.metadata.tags);
      this.indexChunks(note.id, note.content);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
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

  private syncExtractedTags(noteId: string, tags: readonly Tag[]): void {
    this.db.prepare("DELETE FROM note_tags WHERE note_id = ? AND source = 'content'").run(noteId);
    if (tags.length === 0) return;

    const insertTag = this.db.prepare(
      'INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING'
    );
    const getTagId = this.db.prepare('SELECT id FROM tags WHERE name = ?');
    const link = this.db.prepare(
      "INSERT OR IGNORE INTO note_tags (note_id, tag_id, source) VALUES (?, ?, 'content')"
    );

    for (const tag of tags) {
      insertTag.run(tag);
      const row = getTagId.get(tag) as { id: number } | undefined;
      if (row) link.run(noteId, row.id);
    }
  }

  private indexChunks(noteId: string, content: string): void {
    const parts = chunkMarkdown(content);
    const existing = this.db
      .prepare(
        `SELECT chunk_index, content_hash, embedding, dim, model
           FROM chunks WHERE note_id = ?`
      )
      .all(noteId) as Array<{
      chunk_index: number;
      content_hash: string;
      embedding: Uint8Array | null;
      dim: number | null;
      model: string | null;
    }>;
    const byIndex = new Map(existing.map(row => [row.chunk_index, row]));
    const now = Date.now();

    this.db.prepare('DELETE FROM chunks WHERE note_id = ?').run(noteId);
    const insert = this.db.prepare(`
      INSERT INTO chunks (
        id, note_id, chunk_index, content, token_count, content_hash,
        embedding, dim, model, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const part of parts) {
      const hash = createHash('sha256').update(part.content, 'utf8').digest('hex');
      const prev = byIndex.get(part.index);
      const reuse = prev !== undefined && prev.content_hash === hash;
      insert.run(
        `${noteId}:${part.index}`,
        noteId,
        part.index,
        part.content,
        part.tokenCount,
        hash,
        reuse ? prev.embedding : null,
        reuse ? prev.dim : null,
        reuse ? prev.model : null,
        now
      );
    }
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
