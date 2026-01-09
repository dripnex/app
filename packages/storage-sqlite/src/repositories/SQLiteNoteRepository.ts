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
  type NoteStatus,
  type Tag,
  type Timestamp,
  createNote,
  createNoteId,
  createNotebookId,
  createTag,
  DEFAULT_NOTE_STATUS,
} from '@readied/core';
import { extractWikilinks } from '@readied/wikilinks';
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
  is_pinned: number; // SQLite stores booleans as 0/1
  is_deleted: number;
  status: string;
}

interface TagRow {
  name: string;
}

interface TagWithColorRow {
  name: string;
  color: string | null;
}

/** Backlink information for UI display */
export interface BacklinkInfo {
  noteId: string;
  noteTitle: string;
  targetRef: string;
}

/** SQLite implementation of ExtendedNoteRepository */
export class SQLiteNoteRepository implements ExtendedNoteRepository {
  constructor(private readonly db: DatabaseConnection) {}

  /** Get a note by ID (includes archived notes) */
  async get(id: NoteId): Promise<Note | null> {
    const stmt = this.db.prepare<NoteRow>(`
      SELECT id, notebook_id, content, title, created_at, updated_at, word_count, archived_at,
             is_pinned, is_deleted, status
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
        INSERT INTO notes (id, notebook_id, content, title, created_at, updated_at, word_count, archived_at,
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
          status = excluded.status
      `);

      stmt.run(
        note.id,
        note.notebookId,
        note.content,
        note.title, // Use structural title
        note.metadata.createdAt,
        note.metadata.updatedAt,
        note.metadata.wordCount,
        note.metadata.archivedAt,
        note.isPinned ? 1 : 0,
        note.isDeleted ? 1 : 0,
        note.status
      );

      // Update content-extracted tags (preserves manual tags)
      this.syncExtractedTags(note.id, note.metadata.tags);
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
        SELECT DISTINCT n.id, n.notebook_id, n.content, n.title, n.created_at, n.updated_at, n.word_count, n.archived_at,
               n.is_pinned, n.is_deleted, n.status
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
        SELECT id, notebook_id, content, title, created_at, updated_at, word_count, archived_at,
               is_pinned, is_deleted, status
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
      SELECT id, notebook_id, content, title, created_at, updated_at, word_count, archived_at,
             is_pinned, is_deleted, status
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

  /** Get all tags (persistent - includes tags not currently in use) */
  async getAllTags(_includeArchived: boolean = false): Promise<Tag[]> {
    // Tags are persistent entities - return all from tags table
    const stmt = this.db.prepare<TagRow>('SELECT name FROM tags ORDER BY name ASC');
    const rows = stmt.all() as TagRow[];
    return rows.map(r => createTag(r.name));
  }

  /**
   * Delete a tag from the system.
   * Also removes all note_tags associations (via CASCADE).
   */
  deleteTag(tagName: string): void {
    const normalized = tagName.trim().toLowerCase();
    const stmt = this.db.prepare('DELETE FROM tags WHERE name = ?');
    stmt.run(normalized);
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
      SELECT DISTINCT t.name
      FROM tags t
      JOIN note_tags nt ON t.id = nt.tag_id
      WHERE nt.note_id = ?
      ORDER BY t.name ASC
    `);
    const rows = stmt.all(noteId) as TagRow[];
    return rows.map(r => createTag(r.name));
  }

  /**
   * Sync content-extracted tags (#tag from markdown).
   * Only affects rows with source='content'.
   */
  private syncExtractedTags(noteId: NoteId, tags: readonly Tag[]): void {
    // Remove existing content-extracted tags for this note
    const deleteStmt = this.db.prepare(
      "DELETE FROM note_tags WHERE note_id = ? AND source = 'content'"
    );
    deleteStmt.run(noteId);

    if (tags.length === 0) return;

    // Ensure all tags exist and link them
    const insertTagStmt = this.db.prepare(`
      INSERT INTO tags (name) VALUES (?)
      ON CONFLICT(name) DO NOTHING
    `);

    const getTagIdStmt = this.db.prepare<{ id: number }>('SELECT id FROM tags WHERE name = ?');

    const linkTagStmt = this.db.prepare(`
      INSERT INTO note_tags (note_id, tag_id, source) VALUES (?, ?, 'content')
      ON CONFLICT(note_id, tag_id) DO NOTHING
    `);

    for (const tag of tags) {
      insertTagStmt.run(tag);
      const tagRow = getTagIdStmt.get(tag) as { id: number };
      linkTagStmt.run(noteId, tagRow.id);
    }
  }

  /**
   * Set manual tags for a note (full replacement).
   * Must be called within a transaction for crash safety.
   */
  setManualTags(noteId: NoteId, tags: readonly Tag[]): void {
    this.db.transaction(() => {
      // Remove existing manual tags for this note
      const deleteStmt = this.db.prepare(
        "DELETE FROM note_tags WHERE note_id = ? AND source = 'manual'"
      );
      deleteStmt.run(noteId);

      if (tags.length === 0) return;

      // Ensure all tags exist and link them
      const insertTagStmt = this.db.prepare(`
        INSERT INTO tags (name) VALUES (?)
        ON CONFLICT(name) DO NOTHING
      `);

      const getTagIdStmt = this.db.prepare<{ id: number }>('SELECT id FROM tags WHERE name = ?');

      const linkTagStmt = this.db.prepare(`
        INSERT INTO note_tags (note_id, tag_id, source) VALUES (?, ?, 'manual')
        ON CONFLICT(note_id, tag_id) DO NOTHING
      `);

      for (const tag of tags) {
        insertTagStmt.run(tag);
        const tagRow = getTagIdStmt.get(tag) as { id: number };
        linkTagStmt.run(noteId, tagRow.id);
      }
    });
  }

  /**
   * Get manual tags only (for UI to determine removability).
   */
  getManualTags(noteId: NoteId): Tag[] {
    const stmt = this.db.prepare<TagRow>(`
      SELECT t.name
      FROM tags t
      JOIN note_tags nt ON t.id = nt.tag_id
      WHERE nt.note_id = ? AND nt.source = 'manual'
      ORDER BY t.name ASC
    `);
    const rows = stmt.all(noteId) as TagRow[];
    return rows.map(r => createTag(r.name));
  }

  /**
   * Get all tags with their colors.
   */
  getAllTagsWithColors(): Array<{ name: string; color: string | null }> {
    const stmt = this.db.prepare<TagWithColorRow>(`
      SELECT name, color FROM tags ORDER BY name ASC
    `);
    const rows = stmt.all() as TagWithColorRow[];
    return rows.map(r => ({ name: r.name, color: r.color }));
  }

  /**
   * Set color for a tag.
   * Normalizes tagName (lowercase, trim) before persisting.
   */
  setTagColor(tagName: string, color: string | null): void {
    const normalized = tagName.trim().toLowerCase();
    const stmt = this.db.prepare(`
      UPDATE tags SET color = ? WHERE name = ?
    `);
    stmt.run(color, normalized);
  }

  /**
   * Rename a tag across all notes.
   * Only affects manual tags (content tags are derived from markdown).
   * Preserves the tag's color.
   */
  renameTag(oldName: string, newName: string): { ok: boolean; error?: string } {
    const normalizedOld = oldName.trim().toLowerCase();
    const normalizedNew = newName.trim().toLowerCase();

    if (!normalizedNew) {
      return { ok: false, error: 'New tag name cannot be empty' };
    }

    if (normalizedOld === normalizedNew) {
      return { ok: true }; // No change needed
    }

    try {
      this.db.transaction(() => {
        // Check if new tag already exists
        const existingStmt = this.db.prepare('SELECT id, color FROM tags WHERE name = ?');
        const existingNew = existingStmt.get(normalizedNew) as
          | { id: number; color: string | null }
          | undefined;
        const existingOld = existingStmt.get(normalizedOld) as
          | { id: number; color: string | null }
          | undefined;

        if (!existingOld) {
          throw new Error('Tag not found');
        }

        if (existingNew) {
          // Merge: move all note_tags from old to new, then delete old tag
          const updateNoteTagsStmt = this.db.prepare(`
            UPDATE OR IGNORE note_tags SET tag_id = ? WHERE tag_id = ?
          `);
          updateNoteTagsStmt.run(existingNew.id, existingOld.id);

          // Delete orphaned note_tags (duplicates that couldn't be updated)
          const deleteOrphanedStmt = this.db.prepare('DELETE FROM note_tags WHERE tag_id = ?');
          deleteOrphanedStmt.run(existingOld.id);

          // Delete old tag
          const deleteOldTagStmt = this.db.prepare('DELETE FROM tags WHERE id = ?');
          deleteOldTagStmt.run(existingOld.id);

          // Preserve color from old tag if new tag has no color
          if (!existingNew.color && existingOld.color) {
            const updateColorStmt = this.db.prepare('UPDATE tags SET color = ? WHERE id = ?');
            updateColorStmt.run(existingOld.color, existingNew.id);
          }
        } else {
          // Simple rename: just update the tag name
          const renameStmt = this.db.prepare('UPDATE tags SET name = ? WHERE name = ?');
          renameStmt.run(normalizedNew, normalizedOld);
        }
      });

      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private rowToNote(row: NoteRow, tags: Tag[]): Note {
    // Reconstruct note from stored data with structural title
    const note = createNote({
      id: createNoteId(row.id),
      notebookId: createNotebookId(row.notebook_id),
      title: row.title, // Structural title from DB
      content: row.content,
      createdAt: row.created_at as Timestamp,
      isPinned: row.is_pinned === 1,
      isDeleted: row.is_deleted === 1,
      status: (row.status as NoteStatus) || DEFAULT_NOTE_STATUS,
    });

    // Return note with stored metadata
    return {
      ...note,
      notebookId: createNotebookId(row.notebook_id),
      title: row.title, // Ensure structural title is set
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Links (Wikilinks / Backlinks)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Sync links for a note based on its content.
   * Replaces all existing links from this note with newly extracted ones.
   *
   * @param noteId - The source note ID
   * @param content - The note content to extract wikilinks from
   */
  syncLinks(noteId: NoteId, content: string): void {
    this.db.transaction(() => {
      // Delete all existing links from this note
      const deleteStmt = this.db.prepare('DELETE FROM links WHERE source_note_id = ?');
      deleteStmt.run(noteId);

      // Extract wikilinks from content
      const wikilinks = extractWikilinks(content);
      if (wikilinks.length === 0) return;

      // Prepare statements
      const findNoteByTitle = this.db.prepare<{ id: string; title: string }>(`
        SELECT id, title FROM notes
        WHERE title = ? COLLATE NOCASE AND archived_at IS NULL
        LIMIT 1
      `);

      const insertLink = this.db.prepare(`
        INSERT INTO links (source_note_id, target_ref, target_note_id)
        VALUES (?, ?, ?)
        ON CONFLICT(source_note_id, target_ref) DO UPDATE SET
          target_note_id = excluded.target_note_id
      `);

      // Insert each link
      for (const wikilink of wikilinks) {
        const targetRef = wikilink.target;

        // Try to resolve target by title (case-insensitive)
        const targetNote = findNoteByTitle.get(targetRef) as { id: string } | undefined;
        const targetNoteId = targetNote?.id ?? null;

        insertLink.run(noteId, targetRef, targetNoteId);
      }
    });
  }

  /**
   * Get all notes that link TO a given note (backlinks).
   *
   * @param noteId - The target note ID
   * @returns Array of backlink info with source note details
   */
  getBacklinks(noteId: NoteId): BacklinkInfo[] {
    const stmt = this.db.prepare<{ source_note_id: string; title: string; target_ref: string }>(`
      SELECT l.source_note_id, n.title, l.target_ref
      FROM links l
      JOIN notes n ON l.source_note_id = n.id
      WHERE l.target_note_id = ? AND n.archived_at IS NULL
      ORDER BY n.updated_at DESC
    `);

    const rows = stmt.all(noteId) as Array<{
      source_note_id: string;
      title: string;
      target_ref: string;
    }>;

    return rows.map(row => ({
      noteId: row.source_note_id,
      noteTitle: row.title,
      targetRef: row.target_ref,
    }));
  }

  /**
   * Get all notes that a given note links TO (outgoing links).
   *
   * @param noteId - The source note ID
   * @returns Array of outgoing link info
   */
  getOutgoingLinks(
    noteId: NoteId
  ): Array<{ targetRef: string; targetNoteId: string | null; targetTitle: string | null }> {
    const stmt = this.db.prepare<{
      target_ref: string;
      target_note_id: string | null;
      target_title: string | null;
    }>(`
      SELECT l.target_ref, l.target_note_id, n.title as target_title
      FROM links l
      LEFT JOIN notes n ON l.target_note_id = n.id
      WHERE l.source_note_id = ?
      ORDER BY l.target_ref
    `);

    const rows = stmt.all(noteId) as Array<{
      target_ref: string;
      target_note_id: string | null;
      target_title: string | null;
    }>;

    return rows.map(row => ({
      targetRef: row.target_ref,
      targetNoteId: row.target_note_id,
      targetTitle: row.target_title,
    }));
  }

  /**
   * Re-resolve all links that reference a given title.
   * Call this when a note is renamed to update resolved links.
   *
   * @param oldTitle - The old note title
   * @param newNoteId - The new note ID to resolve to (or null to break links)
   */
  reResolveLinks(title: string, noteId: NoteId | null): void {
    const stmt = this.db.prepare(`
      UPDATE links
      SET target_note_id = ?
      WHERE target_ref = ? COLLATE NOCASE
    `);
    stmt.run(noteId, title);
  }

  /**
   * Get all data needed for graph visualization.
   * Returns nodes (notes) and edges (resolved links).
   */
  getGraphData(): {
    nodes: Array<{ id: string; title: string; notebookId: string }>;
    edges: Array<{ source: string; target: string }>;
  } {
    // Get all non-archived notes
    const notesStmt = this.db.prepare<{ id: string; title: string; notebook_id: string }>(`
      SELECT id, title, notebook_id
      FROM notes
      WHERE archived_at IS NULL
    `);
    const noteRows = notesStmt.all() as Array<{
      id: string;
      title: string;
      notebook_id: string;
    }>;

    // Get all resolved links (where both source and target exist)
    const linksStmt = this.db.prepare<{ source: string; target: string }>(`
      SELECT l.source_note_id as source, l.target_note_id as target
      FROM links l
      JOIN notes n1 ON l.source_note_id = n1.id
      JOIN notes n2 ON l.target_note_id = n2.id
      WHERE l.target_note_id IS NOT NULL
        AND n1.archived_at IS NULL
        AND n2.archived_at IS NULL
    `);
    const linkRows = linksStmt.all() as Array<{ source: string; target: string }>;

    return {
      nodes: noteRows.map(row => ({
        id: row.id,
        title: row.title,
        notebookId: row.notebook_id,
      })),
      edges: linkRows,
    };
  }

  // ========================================================================
  // Sync Tracking Methods
  // ========================================================================

  /**
   * Get all notes that need to be synced to the server.
   * Returns notes where needs_sync=1, ordered by local_version.
   *
   * @param limit - Maximum number of notes to return (default: 50)
   * @returns Array of notes pending sync with their sync metadata
   */
  getPendingChanges(limit = 50): Array<{
    note: Note;
    localVersion: number;
    lastSyncedAt: string | null;
  }> {
    const stmt = this.db.prepare<{
      id: string;
      content: string;
      title: string;
      created_at: string;
      updated_at: string;
      word_count: number;
      archived_at: string | null;
      notebook_id: string;
      is_pinned: number;
      is_deleted: number;
      status: string;
      local_version: number;
      last_synced_at: string | null;
    }>(`
      SELECT *
      FROM notes
      WHERE needs_sync = 1
      ORDER BY local_version ASC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as Array<{
      id: string;
      content: string;
      title: string;
      created_at: string;
      updated_at: string;
      word_count: number;
      archived_at: string | null;
      notebook_id: string;
      is_pinned: number;
      is_deleted: number;
      status: string;
      local_version: number;
      last_synced_at: string | null;
    }>;

    return rows.map(row => {
      const tags = this.getTagsForNote(createNoteId(row.id));
      return {
        note: this.rowToNote(row, tags),
        localVersion: row.local_version,
        lastSyncedAt: row.last_synced_at,
      };
    });
  }

  /**
   * Mark a note as successfully synced.
   * Sets needs_sync=0 and updates last_synced_at timestamp.
   *
   * @param noteId - The note ID to mark as synced
   */
  markAsSynced(noteId: NoteId): void {
    const stmt = this.db.prepare(`
      UPDATE notes
      SET
        needs_sync = 0,
        last_synced_at = ?
      WHERE id = ?
    `);

    const now = new Date().toISOString();
    stmt.run(now, noteId);
  }

  /**
   * Mark multiple notes as synced in a transaction.
   * More efficient than calling markAsSynced individually.
   *
   * @param noteIds - Array of note IDs to mark as synced
   */
  markMultipleAsSynced(noteIds: NoteId[]): void {
    if (noteIds.length === 0) return;

    this.db.transaction(() => {
      const stmt = this.db.prepare(`
        UPDATE notes
        SET
          needs_sync = 0,
          last_synced_at = ?
        WHERE id = ?
      `);

      const now = new Date().toISOString();
      for (const id of noteIds) {
        stmt.run(now, id);
      }
    });
  }

  /**
   * Get sync statistics for monitoring.
   * Returns count of notes needing sync and last sync timestamp.
   */
  getSyncStats(): {
    pendingCount: number;
    lastSyncedAt: string | null;
  } {
    // Count pending notes
    const countStmt = this.db.prepare<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM notes
      WHERE needs_sync = 1
    `);
    const countRow = countStmt.get() as { count: number } | undefined;

    // Get most recent sync timestamp
    const lastSyncStmt = this.db.prepare<{ last_synced_at: string | null }>(`
      SELECT last_synced_at
      FROM notes
      WHERE last_synced_at IS NOT NULL
      ORDER BY last_synced_at DESC
      LIMIT 1
    `);
    const lastSyncRow = lastSyncStmt.get() as { last_synced_at: string | null } | undefined;

    return {
      pendingCount: countRow?.count || 0,
      lastSyncedAt: lastSyncRow?.last_synced_at || null,
    };
  }

  /**
   * Reset sync tracking for a note (force re-sync).
   * Sets needs_sync=1 and increments local_version.
   *
   * Useful for:
   * - Manual re-sync after conflict resolution
   * - Recovery from sync errors
   *
   * @param noteId - The note ID to reset
   */
  resetSyncTracking(noteId: NoteId): void {
    const stmt = this.db.prepare(`
      UPDATE notes
      SET
        needs_sync = 1,
        local_version = local_version + 1
      WHERE id = ?
    `);
    stmt.run(noteId);
  }
}
