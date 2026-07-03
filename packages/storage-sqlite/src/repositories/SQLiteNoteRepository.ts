/**
 * SQLite Note Repository
 *
 * Implements the ExtendedNoteRepository interface from @dripnex/storage-core
 */

import type { ExtendedNoteRepository, ListNotesOptions } from '@dripnex/storage-core';
import {
  type Note,
  type NoteId,
  type Tag,
  type BoardStage,
  createNoteId,
  createTag,
  PLANNING_NOTEBOOK_ID,
} from '@dripnex/core';
import { extractWikilinks } from '@dripnex/wikilinks';
import type { DatabaseConnection } from '../database.js';
import {
  rowToNote,
  prepareFtsQuery,
  archivedConditionSql,
  type NoteRow,
  type TagRow,
  type TagWithColorRow,
  type BacklinkInfo,
} from './noteMapping.js';

// Re-export public types so external imports (e.g. desktop's handlers/types.ts)
// keep working unchanged.
export type { BacklinkInfo };

/** Sync history entry returned by getSyncHistory */
export interface SyncHistoryEntry {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'success' | 'partial' | 'error';
  notesPulled: number;
  notesPushed: number;
  notebooksPulled: number;
  notebooksPushed: number;
  tagsPulled: number;
  tagsPushed: number;
  conflicts: number;
  bytesSent: number;
  bytesReceived: number;
  errorMessage: string | null;
}

/** SQLite implementation of ExtendedNoteRepository */
export class SQLiteNoteRepository implements ExtendedNoteRepository {
  constructor(private readonly db: DatabaseConnection) {}

  /** Get a note by ID (includes archived notes) */
  async get(id: NoteId): Promise<Note | null> {
    const stmt = this.db.prepare<NoteRow>(`
      SELECT id, notebook_id, content, title, created_at, updated_at, word_count, archived_at,
             is_pinned, is_deleted, status, board_stage, priority, board_order
      FROM notes
      WHERE id = ?
    `);

    const row = stmt.get(id) as NoteRow | undefined;
    if (!row) return null;

    const tags = this.getTagsForNote(id);
    return rowToNote(row, tags);
  }

  /** Save a note (insert or update) */
  async save(note: Note): Promise<void> {
    this.db.transaction(() => {
      // Upsert note
      const stmt = this.db.prepare(`
        INSERT INTO notes (id, notebook_id, content, title, created_at, updated_at, word_count, archived_at,
                           is_pinned, is_deleted, status, board_stage, priority, board_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          notebook_id = excluded.notebook_id,
          content = excluded.content,
          title = excluded.title,
          updated_at = excluded.updated_at,
          word_count = excluded.word_count,
          archived_at = excluded.archived_at,
          is_pinned = excluded.is_pinned,
          is_deleted = excluded.is_deleted,
          status = excluded.status,
          board_stage = excluded.board_stage,
          priority = excluded.priority,
          board_order = excluded.board_order
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
        note.status,
        note.boardStage,
        note.priority,
        note.boardOrder
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

  /**
   * Reindex a Planning board column in one atomic transaction: every id gets
   * board_stage=stage and board_order=its position. Direct metadata UPDATEs
   * (no content change, so no tag re-extraction). The `notebook_id` guard means
   * board metadata can only ever land on Planning-notebook notes.
   */
  reorderBoard(stage: BoardStage, orderedIds: readonly string[]): void {
    const update = this.db.prepare(
      'UPDATE notes SET board_stage = ?, board_order = ? WHERE id = ? AND notebook_id = ?'
    );
    this.db.transaction(() => {
      orderedIds.forEach((id, index) => {
        update.run(stage, index, id, PLANNING_NOTEBOOK_ID);
      });
    });
  }

  /** List notes with optional filtering and pagination */
  async list(options: ListNotesOptions = {}): Promise<Note[]> {
    const {
      limit = 50,
      offset = 0,
      tag,
      notebookId,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      archived = 'active',
    } = options;

    const sortColumn = {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      title: 'title',
    }[sortBy];

    const archivedCondition = archivedConditionSql(archived, 'n');
    const notebookCondition = notebookId ? 'AND n.notebook_id = ?' : '';
    let sql: string;
    let params: (string | number)[];

    if (tag) {
      sql = `
        SELECT DISTINCT n.id, n.notebook_id, n.content, n.title, n.created_at, n.updated_at, n.word_count, n.archived_at,
               n.is_pinned, n.is_deleted, n.status, n.board_stage, n.priority, n.board_order
        FROM notes n
        JOIN note_tags nt ON n.id = nt.note_id
        JOIN tags t ON nt.tag_id = t.id
        WHERE t.name = ? ${archivedCondition} ${notebookCondition}
        ORDER BY n.${sortColumn} ${sortOrder.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      params = notebookId
        ? [tag.toLowerCase(), notebookId, limit, offset]
        : [tag.toLowerCase(), limit, offset];
    } else {
      sql = `
        SELECT id, notebook_id, content, title, created_at, updated_at, word_count, archived_at,
               is_pinned, is_deleted, status, board_stage, priority, board_order
        FROM notes n
        WHERE 1=1 ${archivedCondition} ${notebookCondition}
        ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      params = notebookId ? [notebookId, limit, offset] : [limit, offset];
    }

    const stmt = this.db.prepare<NoteRow>(sql);
    const rows = stmt.all(...params) as NoteRow[];

    return rows.map(row => {
      const tags = this.getTagsForNote(createNoteId(row.id));
      return rowToNote(row, tags);
    });
  }

  /** Search notes using FTS5 full-text search with relevance ranking */
  async search(
    query: string,
    limit: number = 20,
    includeArchived: boolean = false
  ): Promise<Note[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const archivedCondition = includeArchived ? '' : 'AND n.archived_at IS NULL';

    // Prepare FTS5 query: escape special chars, add prefix matching
    const ftsQuery = prepareFtsQuery(trimmedQuery);

    const stmt = this.db.prepare<NoteRow>(`
      SELECT n.id, n.notebook_id, n.content, n.title, n.created_at, n.updated_at,
             n.word_count, n.archived_at, n.is_pinned, n.is_deleted, n.status, n.board_stage, n.priority, n.board_order
      FROM notes_fts fts
      JOIN notes n ON fts.id = n.id
      WHERE notes_fts MATCH ? ${archivedCondition}
      ORDER BY bm25(notes_fts)
      LIMIT ?
    `);

    const rows = stmt.all(ftsQuery, limit) as NoteRow[];

    return rows.map(row => {
      const tags = this.getTagsForNote(createNoteId(row.id));
      return rowToNote(row, tags);
    });
  }

  // prepareFtsQuery moved to noteMapping.ts

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

  // getArchivedCondition moved to noteMapping.archivedConditionSql

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

  // rowToNote moved to noteMapping.ts

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
        INSERT INTO links (source_note_id, target_ref, target_note_id, target_anchor)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(source_note_id, target_ref, COALESCE(target_anchor, '')) DO UPDATE SET
          target_note_id = excluded.target_note_id
      `);

      // Insert each link
      for (const wikilink of wikilinks) {
        const targetRef = wikilink.target;
        const targetAnchor = wikilink.anchor ?? null;

        // Try to resolve target by title (case-insensitive)
        const targetNote = findNoteByTitle.get(targetRef) as { id: string } | undefined;
        const targetNoteId = targetNote?.id ?? null;

        insertLink.run(noteId, targetRef, targetNoteId, targetAnchor);
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
      board_stage: string | null;
      priority: string | null;
      board_order: number;
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
      board_stage: string | null;
      priority: string | null;
      board_order: number;
      local_version: number;
      last_synced_at: string | null;
    }>;

    return rows.map(row => {
      const tags = this.getTagsForNote(createNoteId(row.id));
      return {
        note: rowToNote(row, tags),
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
   * Check if a note has unsynced local edits.
   *
   * @param noteId - The note ID to check
   * @returns true if the note has pending local changes
   */
  hasPendingEdits(noteId: NoteId): boolean {
    const stmt = this.db.prepare(`
      SELECT needs_sync
      FROM notes
      WHERE id = ?
    `);
    const row = stmt.get(noteId) as { needs_sync: number } | undefined;
    return row?.needs_sync === 1;
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

  // ============================================================================
  // Tag Sync Methods
  // ============================================================================

  /**
   * Get tags with pending sync changes
   */
  getTagsPendingSync(limit: number): Array<{
    tag: { id: number; uuid: string; name: string; color: string | null };
    localVersion: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT id, uuid, name, color, local_version
      FROM tags
      WHERE needs_sync = 1 AND uuid IS NOT NULL
      LIMIT ?
    `);
    const rows = stmt.all(limit) as Array<{
      id: number;
      uuid: string;
      name: string;
      color: string | null;
      local_version: number;
    }>;
    return rows.map(row => ({
      tag: { id: row.id, uuid: row.uuid, name: row.name, color: row.color },
      localVersion: row.local_version,
    }));
  }

  /**
   * Mark a tag as synced (clear needs_sync flag)
   */
  markTagAsSynced(tagUuid: string): void {
    const stmt = this.db.prepare(`
      UPDATE tags SET needs_sync = 0, last_synced_at = ? WHERE uuid = ?
    `);
    stmt.run(new Date().toISOString(), tagUuid);
  }

  /**
   * Mark multiple tags as synced
   */
  markMultipleTagsAsSynced(tagUuids: string[]): void {
    this.db.transaction(() => {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE tags SET needs_sync = 0, last_synced_at = ? WHERE uuid = ?
      `);
      for (const uuid of tagUuids) {
        stmt.run(now, uuid);
      }
    });
  }

  /**
   * Upsert a tag from remote sync (dedup by name)
   * Returns the local tag id.
   */
  upsertTagFromRemote(uuid: string, name: string, color: string | null): number {
    return this.db.transaction(() => {
      const normalized = name.trim().toLowerCase();

      // Check if tag exists by UUID first
      const byUuid = this.db
        .prepare('SELECT id, name, color FROM tags WHERE uuid = ?')
        .get(uuid) as { id: number; name: string; color: string | null } | undefined;

      if (byUuid) {
        // Update existing tag
        this.db
          .prepare(
            'UPDATE tags SET name = ?, color = ?, needs_sync = 0, last_synced_at = ? WHERE uuid = ?'
          )
          .run(normalized, color, new Date().toISOString(), uuid);
        return byUuid.id;
      }

      // Check if tag exists by name (dedup)
      const byName = this.db.prepare('SELECT id, uuid FROM tags WHERE name = ?').get(normalized) as
        | { id: number; uuid: string | null }
        | undefined;

      if (byName) {
        // Merge: adopt the remote UUID, update color
        this.db
          .prepare(
            'UPDATE tags SET uuid = ?, color = ?, needs_sync = 0, last_synced_at = ? WHERE id = ?'
          )
          .run(uuid, color, new Date().toISOString(), byName.id);
        return byName.id;
      }

      // Create new tag
      const result = this.db
        .prepare(
          'INSERT INTO tags (name, color, uuid, needs_sync, last_synced_at) VALUES (?, ?, ?, 0, ?)'
        )
        .run(normalized, color, uuid, new Date().toISOString());
      return Number(result.lastInsertRowid);
    });
  }

  /**
   * Delete a tag by UUID (from remote sync)
   */
  deleteTagByUuid(uuid: string): void {
    this.db.prepare('DELETE FROM tags WHERE uuid = ?').run(uuid);
  }

  /**
   * Get tag UUID by name
   */
  getTagUuid(tagName: string): string | null {
    const normalized = tagName.trim().toLowerCase();
    const row = this.db.prepare('SELECT uuid FROM tags WHERE name = ?').get(normalized) as
      | { uuid: string | null }
      | undefined;
    return row?.uuid ?? null;
  }

  // ============================================================================
  // Sync History Methods
  // ============================================================================

  /**
   * Create a new sync history entry marking the start of a sync cycle.
   * Prunes old entries to keep only the latest 100.
   *
   * @param id - Unique identifier for this sync cycle
   */
  createSyncHistoryEntry(id: string): void {
    this.db.transaction(() => {
      const insertStmt = this.db.prepare(`
        INSERT INTO sync_history (id, started_at, status)
        VALUES (?, datetime('now'), 'running')
      `);
      insertStmt.run(id);

      // Prune old entries, keep latest 100
      const pruneStmt = this.db.prepare(`
        DELETE FROM sync_history
        WHERE id NOT IN (
          SELECT id FROM sync_history
          ORDER BY started_at DESC
          LIMIT 100
        )
      `);
      pruneStmt.run();
    });
  }

  /**
   * Complete a sync history entry with final status and metrics.
   *
   * @param id - The sync cycle ID
   * @param status - Final status: 'success', 'partial', or 'error'
   * @param metrics - Sync cycle metrics
   */
  completeSyncHistoryEntry(
    id: string,
    status: 'success' | 'partial' | 'error',
    metrics: {
      notesPulled: number;
      notesPushed: number;
      notebooksPulled: number;
      notebooksPushed: number;
      tagsPulled: number;
      tagsPushed: number;
      conflicts: number;
      bytesSent: number;
      bytesReceived: number;
      errorMessage?: string;
    }
  ): void {
    const stmt = this.db.prepare(`
      UPDATE sync_history
      SET
        completed_at = datetime('now'),
        status = ?,
        notes_pulled = ?,
        notes_pushed = ?,
        notebooks_pulled = ?,
        notebooks_pushed = ?,
        tags_pulled = ?,
        tags_pushed = ?,
        conflicts = ?,
        bytes_sent = ?,
        bytes_received = ?,
        error_message = ?
      WHERE id = ?
    `);
    stmt.run(
      status,
      metrics.notesPulled,
      metrics.notesPushed,
      metrics.notebooksPulled,
      metrics.notebooksPushed,
      metrics.tagsPulled,
      metrics.tagsPushed,
      metrics.conflicts,
      metrics.bytesSent,
      metrics.bytesReceived,
      metrics.errorMessage ?? null,
      id
    );
  }

  /**
   * Get recent sync history entries.
   *
   * @param limit - Maximum number of entries to return (default: 20)
   * @returns Array of sync history entries, newest first
   */
  getSyncHistory(limit = 20): SyncHistoryEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, started_at, completed_at, status,
             notes_pulled, notes_pushed,
             notebooks_pulled, notebooks_pushed,
             tags_pulled, tags_pushed,
             conflicts, bytes_sent, bytes_received,
             error_message
      FROM sync_history
      ORDER BY started_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as Array<{
      id: string;
      started_at: string;
      completed_at: string | null;
      status: string;
      notes_pulled: number;
      notes_pushed: number;
      notebooks_pulled: number;
      notebooks_pushed: number;
      tags_pulled: number;
      tags_pushed: number;
      conflicts: number;
      bytes_sent: number;
      bytes_received: number;
      error_message: string | null;
    }>;

    return rows.map(row => ({
      id: row.id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status as SyncHistoryEntry['status'],
      notesPulled: row.notes_pulled,
      notesPushed: row.notes_pushed,
      notebooksPulled: row.notebooks_pulled,
      notebooksPushed: row.notebooks_pushed,
      tagsPulled: row.tags_pulled,
      tagsPushed: row.tags_pushed,
      conflicts: row.conflicts,
      bytesSent: row.bytes_sent,
      bytesReceived: row.bytes_received,
      errorMessage: row.error_message,
    }));
  }
}
