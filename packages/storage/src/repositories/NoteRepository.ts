/**
 * SQLite Note Repository
 *
 * Implements the NoteRepository interface from @readied/core
 */

import type { DatabaseConnection } from '../database.js';
import {
  type Note,
  type NoteId,
  type Tag,
  type Timestamp,
  createNote,
  createNoteId,
  createTag,
} from '@readied/core';

/** Row type from SQLite */
interface NoteRow {
  id: string;
  content: string;
  title: string;
  created_at: string;
  updated_at: string;
  word_count: number;
}

interface TagRow {
  name: string;
}

/** Query options for listing notes */
export interface ListNotesOptions {
  limit?: number;
  offset?: number;
  tag?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

/** SQLite implementation of NoteRepository */
export class SQLiteNoteRepository {
  constructor(private readonly db: DatabaseConnection) {}

  /** Get a note by ID */
  async get(id: NoteId): Promise<Note | null> {
    const stmt = this.db.prepare<NoteRow>(`
      SELECT id, content, title, created_at, updated_at, word_count
      FROM notes
      WHERE id = ?
    `);

    const row = stmt.get(id) as NoteRow | undefined;
    if (!row) return null;

    const tags = this.getTagsForNote(id);
    return this.rowToNote(row, tags);
  }

  /** Save a note (insert or update) */
  async save(note: Note): Promise<void> {
    this.db.transaction(() => {
      // Upsert note
      const stmt = this.db.prepare(`
        INSERT INTO notes (id, content, title, created_at, updated_at, word_count)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          content = excluded.content,
          title = excluded.title,
          updated_at = excluded.updated_at,
          word_count = excluded.word_count
      `);

      stmt.run(
        note.id,
        note.content,
        note.metadata.title,
        note.metadata.createdAt,
        note.metadata.updatedAt,
        note.metadata.wordCount
      );

      // Update tags
      this.syncNoteTags(note.id, note.metadata.tags);
    });
  }

  /** Delete a note by ID */
  async delete(id: NoteId): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM notes WHERE id = ?');
    stmt.run(id);
    // Tags are cleaned up via ON DELETE CASCADE
  }

  /** List notes with optional filtering and pagination */
  async list(options: ListNotesOptions = {}): Promise<Note[]> {
    const {
      limit = 50,
      offset = 0,
      tag,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = options;

    const sortColumn = {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      title: 'title',
    }[sortBy];

    let sql: string;
    let params: (string | number)[];

    if (tag) {
      sql = `
        SELECT DISTINCT n.id, n.content, n.title, n.created_at, n.updated_at, n.word_count
        FROM notes n
        JOIN note_tags nt ON n.id = nt.note_id
        JOIN tags t ON nt.tag_id = t.id
        WHERE t.name = ?
        ORDER BY n.${sortColumn} ${sortOrder.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      params = [tag.toLowerCase(), limit, offset];
    } else {
      sql = `
        SELECT id, content, title, created_at, updated_at, word_count
        FROM notes
        ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      params = [limit, offset];
    }

    const stmt = this.db.prepare<NoteRow>(sql);
    const rows = stmt.all(...params) as NoteRow[];

    return rows.map(row => {
      const tags = this.getTagsForNote(createNoteId(row.id));
      return this.rowToNote(row, tags);
    });
  }

  /** Search notes by content (basic LIKE search) */
  async search(query: string, limit: number = 20): Promise<Note[]> {
    const stmt = this.db.prepare<NoteRow>(`
      SELECT id, content, title, created_at, updated_at, word_count
      FROM notes
      WHERE content LIKE ? OR title LIKE ?
      ORDER BY updated_at DESC
      LIMIT ?
    `);

    const pattern = `%${query}%`;
    const rows = stmt.all(pattern, pattern, limit) as NoteRow[];

    return rows.map(row => {
      const tags = this.getTagsForNote(createNoteId(row.id));
      return this.rowToNote(row, tags);
    });
  }

  /** Get total count of notes */
  async count(): Promise<number> {
    const stmt = this.db.prepare<{ count: number }>('SELECT COUNT(*) as count FROM notes');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  /** Get all unique tags */
  async getAllTags(): Promise<Tag[]> {
    const stmt = this.db.prepare<TagRow>('SELECT name FROM tags ORDER BY name');
    const rows = stmt.all() as TagRow[];
    return rows.map(r => createTag(r.name));
  }

  // Private helpers

  private getTagsForNote(noteId: NoteId): Tag[] {
    const stmt = this.db.prepare<TagRow>(`
      SELECT t.name
      FROM tags t
      JOIN note_tags nt ON t.id = nt.tag_id
      WHERE nt.note_id = ?
    `);
    const rows = stmt.all(noteId) as TagRow[];
    return rows.map(r => createTag(r.name));
  }

  private syncNoteTags(noteId: NoteId, tags: readonly Tag[]): void {
    // Remove existing tags for this note
    const deleteStmt = this.db.prepare('DELETE FROM note_tags WHERE note_id = ?');
    deleteStmt.run(noteId);

    if (tags.length === 0) return;

    // Ensure all tags exist and link them
    const insertTagStmt = this.db.prepare(`
      INSERT INTO tags (name) VALUES (?)
      ON CONFLICT(name) DO NOTHING
    `);

    const getTagIdStmt = this.db.prepare<{ id: number }>('SELECT id FROM tags WHERE name = ?');

    const linkTagStmt = this.db.prepare(`
      INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)
    `);

    for (const tag of tags) {
      insertTagStmt.run(tag);
      const tagRow = getTagIdStmt.get(tag) as { id: number };
      linkTagStmt.run(noteId, tagRow.id);
    }
  }

  private rowToNote(row: NoteRow, tags: Tag[]): Note {
    // Reconstruct note from stored data
    // We use createNote to ensure proper structure, but override metadata
    const note = createNote({
      id: createNoteId(row.id),
      content: row.content,
      createdAt: row.created_at as Timestamp,
    });

    // Return note with stored metadata (in case of any differences)
    return {
      ...note,
      metadata: {
        ...note.metadata,
        title: row.title,
        createdAt: row.created_at as Timestamp,
        updatedAt: row.updated_at as Timestamp,
        tags,
        wordCount: row.word_count,
      },
    };
  }
}
