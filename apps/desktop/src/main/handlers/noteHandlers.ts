/**
 * Note, Tag, and Link IPC Handlers
 *
 * Handles notes CRUD, tag management, wikilinks/backlinks, and note counts.
 */

import { join } from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { ipcMain } from 'electron';
import {
  createNoteOperation,
  updateNoteOperation,
  updateTitleOperation,
  deleteNoteOperation,
  getNoteOperation,
  archiveNoteOperation,
  restoreNoteOperation,
  duplicateNoteOperation,
  moveNoteToNotebook,
  pinNote,
  unpinNote,
  softDeleteNote,
  restoreDeletedNote,
  setNoteStatus,
  type NoteStatus,
} from '@readied/core';
import { createNoteId, createNotebookId, createTag } from '@readied/core';
import type { SQLiteNoteRepository, DataPaths, NoteToSnapshotFn } from './types.js';

export interface NoteHandlerDeps {
  noteRepository: SQLiteNoteRepository;
  dataPaths: DataPaths;
  noteToSnapshot: NoteToSnapshotFn;
}

export function registerNoteHandlers(deps: NoteHandlerDeps): void {
  const { noteRepository: repo, dataPaths, noteToSnapshot } = deps;

  // Create note
  ipcMain.handle(
    'notes:create',
    async (_event, input: { content: string; id?: string; notebookId?: string }) => {
      return createNoteOperation(input, repo);
    }
  );

  // Get note
  ipcMain.handle('notes:get', async (_event, id: string) => {
    const noteId = createNoteId(id);
    return getNoteOperation({ id: noteId }, repo);
  });

  // Update note content
  ipcMain.handle('notes:update', async (_event, input: { id: string; content: string }) => {
    const noteId = createNoteId(input.id);
    return updateNoteOperation({ id: noteId, content: input.content }, repo);
  });

  // Update note title (structural, independent from content)
  ipcMain.handle('notes:updateTitle', async (_event, input: { id: string; title: string }) => {
    const noteId = createNoteId(input.id);
    return updateTitleOperation({ id: noteId, title: input.title }, repo);
  });

  // Delete note
  ipcMain.handle('notes:delete', async (_event, id: string) => {
    const noteId = createNoteId(id);
    return deleteNoteOperation({ id: noteId }, repo);
  });

  // Archive note
  ipcMain.handle('notes:archive', async (_event, id: string) => {
    const noteId = createNoteId(id);
    return archiveNoteOperation({ id: noteId }, repo);
  });

  // Restore note
  ipcMain.handle('notes:restore', async (_event, id: string) => {
    const noteId = createNoteId(id);
    return restoreNoteOperation({ id: noteId }, repo);
  });

  // Duplicate note
  ipcMain.handle('notes:duplicate', async (_event, id: string) => {
    const noteId = createNoteId(id);
    return duplicateNoteOperation({ id: noteId }, repo);
  });

  // Move note to notebook
  ipcMain.handle('notes:move', async (_event, noteId: string, notebookId: string) => {
    const note = await repo.get(createNoteId(noteId));
    if (!note) {
      return { ok: false, error: { type: 'NOT_FOUND', id: noteId } };
    }

    const movedNote = moveNoteToNotebook(note, createNotebookId(notebookId));
    await repo.save(movedNote);

    return {
      ok: true,
      data: noteToSnapshot(movedNote),
    };
  });

  // Pin note
  ipcMain.handle('notes:pin', async (_event, id: string) => {
    const note = await repo.get(createNoteId(id));
    if (!note) {
      return { ok: false, error: { type: 'NOT_FOUND', id } };
    }

    const pinnedNote = pinNote(note);
    await repo.save(pinnedNote);

    return { ok: true, data: noteToSnapshot(pinnedNote) };
  });

  // Unpin note
  ipcMain.handle('notes:unpin', async (_event, id: string) => {
    const note = await repo.get(createNoteId(id));
    if (!note) {
      return { ok: false, error: { type: 'NOT_FOUND', id } };
    }

    const unpinnedNote = unpinNote(note);
    await repo.save(unpinnedNote);

    return { ok: true, data: noteToSnapshot(unpinnedNote) };
  });

  // Soft delete (move to trash)
  ipcMain.handle('notes:softDelete', async (_event, id: string) => {
    const note = await repo.get(createNoteId(id));
    if (!note) {
      return { ok: false, error: { type: 'NOT_FOUND', id } };
    }

    const deletedNote = softDeleteNote(note);
    await repo.save(deletedNote);

    return { ok: true, data: noteToSnapshot(deletedNote) };
  });

  // Restore from trash
  ipcMain.handle('notes:restoreDeleted', async (_event, id: string) => {
    const note = await repo.get(createNoteId(id));
    if (!note) {
      return { ok: false, error: { type: 'NOT_FOUND', id } };
    }

    const restoredNote = restoreDeletedNote(note);
    await repo.save(restoredNote);

    return { ok: true, data: noteToSnapshot(restoredNote) };
  });

  // Set note status
  ipcMain.handle('notes:setStatus', async (_event, id: string, status: NoteStatus) => {
    const note = await repo.get(createNoteId(id));
    if (!note) {
      return { ok: false, error: { type: 'NOT_FOUND', id } };
    }

    const updatedNote = setNoteStatus(note, status);
    await repo.save(updatedNote);

    return { ok: true, data: noteToSnapshot(updatedNote) };
  });

  // List notes
  ipcMain.handle(
    'notes:list',
    async (
      _event,
      options?: {
        limit?: number;
        offset?: number;
        tag?: string;
        sortBy?: 'createdAt' | 'updatedAt' | 'title';
        sortOrder?: 'asc' | 'desc';
        archived?: 'active' | 'archived' | 'all';
      }
    ) => {
      const notes = await repo.list(options);
      return notes.map(note => noteToSnapshot(note));
    }
  );

  // Search notes
  ipcMain.handle('notes:search', async (_event, query: string, limit?: number) => {
    const notes = await repo.search(query, limit);
    return notes.map(note => noteToSnapshot(note));
  });

  // Get all tags
  ipcMain.handle('notes:tags', async () => {
    return repo.getAllTags();
  });

  // Set manual tags (full replacement)
  ipcMain.handle('notes:setManualTags', async (_event, noteId: string, tags: string[]) => {
    const id = createNoteId(noteId);
    // Normalize tags: trim, lowercase, strip leading '#', remove empties, dedupe
    const normalizedTags = [
      ...new Set(tags.map(t => t.trim().toLowerCase().replace(/^#/, '')).filter(t => t.length > 0)),
    ];
    repo.setManualTags(
      id,
      normalizedTags.map(t => createTag(t))
    );
    return { ok: true };
  });

  // Get manual tags only (for editor to know which are removable)
  ipcMain.handle('notes:getManualTags', async (_event, noteId: string) => {
    const id = createNoteId(noteId);
    return repo.getManualTags(id);
  });

  // Get all tags with colors
  ipcMain.handle('tags:listWithColors', async () => {
    return repo.getAllTagsWithColors();
  });

  // Set tag color
  ipcMain.handle('tags:setColor', async (_event, tagName: string, color: string | null) => {
    repo.setTagColor(tagName, color);
    return { ok: true };
  });

  // Delete tag from system
  ipcMain.handle('tags:delete', async (_event, tagName: string) => {
    repo.deleteTag(tagName);
    return { ok: true };
  });

  // Rename tag across all notes
  ipcMain.handle('tags:rename', async (_event, oldName: string, newName: string) => {
    return repo.renameTag(oldName, newName);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Links (Wikilinks / Backlinks)
  // ═══════════════════════════════════════════════════════════════════════════

  // Sync links for a note (call after saving note)
  ipcMain.handle('links:sync', async (_event, noteId: string, content: string) => {
    repo.syncLinks(createNoteId(noteId), content);
    return { ok: true };
  });

  // Get backlinks (notes that link TO this note)
  ipcMain.handle('links:backlinks', async (_event, noteId: string) => {
    return repo.getBacklinks(createNoteId(noteId));
  });

  // Get outgoing links (notes this note links TO)
  ipcMain.handle('links:outgoing', async (_event, noteId: string) => {
    return repo.getOutgoingLinks(createNoteId(noteId));
  });

  // Get graph data (all notes and links for visualization)
  ipcMain.handle('links:graph', async () => {
    try {
      return repo.getGraphData();
    } catch (error) {
      console.error('Failed to get graph data:', error);
      // Return empty data on error
      return { nodes: [], edges: [] };
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Embeds (File Resolution)
  // ═══════════════════════════════════════════════════════════════════════════

  // Resolve embed target to asset:// URL
  ipcMain.handle('embeds:resolve', async (_event, target: string, noteId: string) => {
    // Build path to note's assets folder: /assets/{noteId}/{target}
    const assetPath = join(dataPaths.assets, noteId, target);

    // Check if file exists
    if (existsSync(assetPath)) {
      // Return asset:// URL with host (required for browser to recognize protocol)
      return `asset://local/${noteId}/${target}`;
    }

    // File not found
    return null;
  });

  // Batch resolve multiple embed targets (more efficient)
  ipcMain.handle(
    'embeds:resolveBatch',
    async (_event, targets: string[], noteId: string): Promise<Record<string, string | null>> => {
      const result: Record<string, string | null> = {};
      for (const target of targets) {
        const assetPath = join(dataPaths.assets, noteId, target);
        // Return asset:// URL with host (required for browser to recognize protocol)
        result[target] = existsSync(assetPath) ? `asset://local/${noteId}/${target}` : null;
      }
      return result;
    }
  );

  // Save asset (image/file) for a note via drag & drop or paste
  ipcMain.handle(
    'embeds:saveAsset',
    async (
      _event,
      noteId: string,
      mime: string,
      bytes: ArrayBuffer,
      originalName?: string
    ): Promise<{ ok: true; filename: string; relPath: string } | { ok: false; error: string }> => {
      // Validate noteId (non-empty, alphanumeric with hyphens/underscores)
      if (!noteId || !/^[\w-]+$/.test(noteId)) {
        return { ok: false, error: 'Invalid noteId' };
      }

      // Validate size (max 20MB)
      const MAX_SIZE = 20 * 1024 * 1024;
      if (bytes.byteLength > MAX_SIZE) {
        return { ok: false, error: 'File too large (max 20MB)' };
      }

      // Derive extension from mime type
      const mimeToExt: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'image/bmp': 'bmp',
        'image/ico': 'ico',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'application/pdf': 'pdf',
      };

      let ext = mimeToExt[mime];
      if (!ext && originalName) {
        // Fallback to originalName extension
        const match = originalName.match(/\.([a-zA-Z0-9]+)$/);
        ext = match?.[1]?.toLowerCase() ?? 'bin';
      }
      if (!ext) {
        ext = 'bin';
      }

      // Generate unique filename: timestamp-random.ext
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const filename = `${timestamp}-${random}.${ext}`;

      // Ensure note's assets directory exists
      const noteAssetsDir = join(dataPaths.assets, noteId);
      await mkdir(noteAssetsDir, { recursive: true });

      // Write file
      const assetPath = join(noteAssetsDir, filename);
      await writeFile(assetPath, Buffer.from(bytes));

      return {
        ok: true,
        filename,
        relPath: `${noteId}/${filename}`,
      };
    }
  );

  // Activity stats (notes created/updated per week, last 52 weeks)
  ipcMain.handle('notes:activityStats', async () => {
    const allNotes = await repo.list({ archived: 'all', limit: 10000 });
    const now = Date.now();
    const fiftyTwoWeeksAgo = now - 52 * 7 * 24 * 60 * 60 * 1000;

    // Build a map of week -> { created, updated }
    const weekMap = new Map<string, { created: number; updated: number }>();

    for (const note of allNotes) {
      const createdMs = new Date(note.metadata.createdAt).getTime();
      const updatedMs = new Date(note.metadata.updatedAt).getTime();

      if (createdMs >= fiftyTwoWeeksAgo) {
        const weekKey = getISOWeek(new Date(note.metadata.createdAt));
        const entry = weekMap.get(weekKey) ?? { created: 0, updated: 0 };
        entry.created++;
        weekMap.set(weekKey, entry);
      }

      if (updatedMs >= fiftyTwoWeeksAgo && updatedMs !== createdMs) {
        const weekKey = getISOWeek(new Date(note.metadata.updatedAt));
        const entry = weekMap.get(weekKey) ?? { created: 0, updated: 0 };
        entry.updated++;
        weekMap.set(weekKey, entry);
      }
    }

    // Convert to sorted array
    const weeks = Array.from(weekMap.entries())
      .map(([week, counts]) => ({ week, ...counts }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Calculate current streak (consecutive weeks with activity ending at current week)
    const currentWeek = getISOWeek(new Date());
    let streak = 0;
    let checkDate = new Date();
    for (let i = 0; i < 52; i++) {
      const weekKey = getISOWeek(checkDate);
      const entry = weekMap.get(weekKey);
      if (entry && (entry.created > 0 || entry.updated > 0)) {
        streak++;
      } else if (i > 0) {
        // Allow current week to have no activity yet
        break;
      }
      checkDate = new Date(checkDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return {
      weeks,
      totalNotes: allNotes.length,
      currentStreak: streak,
      currentWeek,
    };
  });

  // Count notes
  ipcMain.handle('notes:count', async () => {
    // Get all notes to compute counts
    const allNotes = await repo.list({ archived: 'all' });

    const counts = {
      active: 0,
      archived: 0,
      total: allNotes.length,
      pinned: 0,
      deleted: 0,
      byStatus: {
        active: 0,
        on_hold: 0,
        completed: 0,
        dropped: 0,
      } as Record<NoteStatus, number>,
      byNotebook: {} as Record<string, number>,
    };

    for (const note of allNotes) {
      // Count archived
      if (note.metadata.archivedAt !== null) {
        counts.archived++;
      } else {
        counts.active++;
      }

      // Count pinned
      if (note.isPinned) {
        counts.pinned++;
      }

      // Count deleted (in trash)
      if (note.isDeleted) {
        counts.deleted++;
      }

      // Count by status
      if (note.status && counts.byStatus[note.status] !== undefined) {
        counts.byStatus[note.status]++;
      }

      // Count by notebook (active, non-deleted notes only)
      if (note.notebookId && !note.isDeleted && !note.metadata.archivedAt) {
        counts.byNotebook[note.notebookId] = (counts.byNotebook[note.notebookId] || 0) + 1;
      }
    }

    return counts;
  });
}

/** Get ISO week string (YYYY-Www) for a date */
function getISOWeek(date: Date): string {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  // Set to nearest Thursday (current date + 4 - current day number, with Sunday=7)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
