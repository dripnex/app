/**
 * SQLite Note Repository
 *
 * Implements the ExtendedNoteRepository interface from @readied/storage-core
 */

import type {
  ExtendedNoteRepository,
  ListNotesOptions,
  ArchivedFilter,
} from '@readied/storage-core';
import {
  type Note,
  type NoteId,
  type Tag,
  type Timestamp,
  createNote,
  createNoteId,
  createNotebookId,
  createTag,
} from '@readied/core';
import type { DatabaseConnection } from '../database.js';

/** Row type from SQLite */
interface NoteRow {
  id: string;
  notebook_id: string;
  content: string;
  title: string;
  created_at: string;
  updated_at: string;
  word_count: number;
  archived_at: string | null;
}

interface TagRow {
  name: string;
}

/** SQLite implementation of ExtendedNoteRepository */
export class SQLiteNoteRepository implements ExtendedNoteRepository {
  constructor(private readonly db: DatabaseConnection) {}

  /** Get a note by ID (includes archived notes) */
  async get(id: NoteId): Promise<Note | null> {
    const stmt = this.db.prepare<NoteRow>(`
      SELECT id, notebook_id, content, title, created_at, updated_at, word_count, archived_at
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
        INSERT INTO notes (id, notebook_id, content, title, created_at, updated_at, word_count, archived_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          notebook_id = excluded.notebook_id,
          content = excluded.content,
          title = excluded.title,
          updated_at = excluded.updated_at,
          word_count = excluded.word_count,
          archived_at = excluded.archived_at
      `);

      stmt.run(
        note.id,
        note.notebookId,
        note.content,
        note.metadata.title,
        note.metadata.createdAt,
        note.metadata.updatedAt,
        note.metadata.wordCount,
        note.metadata.archivedAt
      );

      // Update tags
      this.syncNoteTags(note.id, note.metadata.tags);
    });
  }

  /** Delete a note by ID (hard delete) */
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
      archived = 'active',
    } = options;

    const sortColumn = {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      title: 'title',
    }[sortBy];

    const archivedCondition = this.getArchivedCondition(archived, 'n');
    let sql: string;
    let params: (string | number)[];

    if (tag) {
      sql = `
        SELECT DISTINCT n.id, n.notebook_id, n.content, n.title, n.created_at, n.updated_at, n.word_count, n.archived_at
        FROM notes n
        JOIN note_tags nt ON n.id = nt.note_id
        JOIN tags t ON nt.tag_id = t.id
        WHERE t.name = ? ${archivedCondition}
        ORDER BY n.${sortColumn} ${sortOrder.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      params = [tag.toLowerCase(), limit, offset];
    } else {
      sql = `
        SELECT id, notebook_id, content, title, created_at, updated_at, word_count, archived_at
        FROM notes n
        WHERE 1=1 ${archivedCondition}
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

  /** Search notes by content (basic LIKE search, excludes archived by default) */
  async search(
    query: string,
    limit: number = 20,
    includeArchived: boolean = false
  ): Promise<Note[]> {
    const archivedCondition = includeArchived ? '' : 'AND archived_at IS NULL';

    const stmt = this.db.prepare<NoteRow>(`
      SELECT id, notebook_id, content, title, created_at, updated_at, word_count, archived_at
      FROM notes
      WHERE (content LIKE ? OR title LIKE ?) ${archivedCondition}
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
  async count(includeArchived: boolean = false): Promise<number> {
    const condition = includeArchived ? '' : 'WHERE archived_at IS NULL';
    const stmt = this.db.prepare<{ count: number }>(
      `SELECT COUNT(*) as count FROM notes ${condition}`
    );
    const row = stmt.get() as { count: number };
    return row.count;
  }

  /** Get count of archived notes */
  async countArchived(): Promise<number> {
    const stmt = this.db.prepare<{ count: number }>(
      'SELECT COUNT(*) as count FROM notes WHERE archived_at IS NOT NULL'
    );
    const row = stmt.get() as { count: number };
    return row.count;
  }

  /** Get all unique tags (from non-archived notes by default) */
  async getAllTags(includeArchived: boolean = false): Promise<Tag[]> {
    const sql = includeArchived
      ? 'SELECT DISTINCT t.name FROM tags t ORDER BY t.name'
      : `SELECT DISTINCT t.name
         FROM tags t
         JOIN note_tags nt ON t.id = nt.tag_id
         JOIN notes n ON nt.note_id = n.id
         WHERE n.archived_at IS NULL
         ORDER BY t.name`;

    const stmt = this.db.prepare<TagRow>(sql);
    const rows = stmt.all() as TagRow[];
    return rows.map(r => createTag(r.name));
  }

  // Private helpers

  private getArchivedCondition(filter: ArchivedFilter, tableAlias: string = ''): string {
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
      notebookId: createNotebookId(row.notebook_id),
      content: row.content,
      createdAt: row.created_at as Timestamp,
    });

    // Return note with stored metadata (in case of any differences)
    return {
      ...note,
      notebookId: createNotebookId(row.notebook_id),
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
}
