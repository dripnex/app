/**
 * Note, Tag, and Link IPC Handlers
 *
 * Handles notes CRUD, tag management, wikilinks/backlinks, and note counts.
 */

import { join } from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { z } from 'zod';
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
} from '@dripnex/core';
import { createNoteId, createNotebookId, createTag } from '@dripnex/core';
import { defineIpcHandler } from '../ipc/registry.js';
import type { SQLiteNoteRepository, DataPaths, NoteToSnapshotFn } from './types.js';

export interface NoteHandlerDeps {
  noteRepository: SQLiteNoteRepository;
  dataPaths: DataPaths;
  noteToSnapshot: NoteToSnapshotFn;
  onNotesChanged?: () => void;
}

const IdSchema = z.string().min(1).max(128);
const TitleSchema = z.string().max(512);
const ContentSchema = z.string().max(10 * 1024 * 1024); // 10 MiB cap on note content
const TagSchema = z.string().min(1).max(64);
const StatusSchema: z.ZodType<NoteStatus> = z.enum(['active', 'on_hold', 'completed', 'dropped']);
const ListNotesOptionsSchema = z.object({
  limit: z.number().int().positive().max(100000).optional(),
  offset: z.number().int().nonnegative().optional(),
  tag: TagSchema.optional(),
  tags: z.array(TagSchema).max(256).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  archived: z.enum(['active', 'archived', 'all']).optional(),
  notebookId: IdSchema.optional(),
  status: StatusSchema.optional(),
  isPinned: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
  excludeNotebookIds: z.array(IdSchema).max(256).optional(),
});

export function registerNoteHandlers(deps: NoteHandlerDeps): void {
  const { noteRepository: repo, dataPaths, noteToSnapshot, onNotesChanged } = deps;
  const kickIndex = () => onNotesChanged?.();

  // ── Notes CRUD ──────────────────────────────────────────────────────────

  defineIpcHandler({
    channel: 'notes:create',
    args: z.tuple([
      z.object({
        content: ContentSchema,
        id: IdSchema.optional(),
        notebookId: IdSchema.optional(),
      }),
    ]),
    handler: async input => {
      const result = await createNoteOperation(input, repo);
      if (result.ok) kickIndex();
      return result;
    },
  });

  defineIpcHandler({
    channel: 'notes:get',
    args: z.tuple([IdSchema]),
    handler: id => getNoteOperation({ id: createNoteId(id) }, repo),
  });

  defineIpcHandler({
    channel: 'notes:update',
    args: z.tuple([z.object({ id: IdSchema, content: ContentSchema })]),
    handler: async input => {
      const result = await updateNoteOperation(
        { id: createNoteId(input.id), content: input.content },
        repo
      );
      if (result.ok) kickIndex();
      return result;
    },
  });

  defineIpcHandler({
    channel: 'notes:updateTitle',
    args: z.tuple([z.object({ id: IdSchema, title: TitleSchema })]),
    handler: async input => {
      const result = await updateTitleOperation(
        { id: createNoteId(input.id), title: input.title },
        repo
      );
      if (result.ok) kickIndex();
      return result;
    },
  });

  defineIpcHandler({
    channel: 'notes:delete',
    args: z.tuple([IdSchema]),
    handler: id => deleteNoteOperation({ id: createNoteId(id) }, repo),
  });

  defineIpcHandler({
    channel: 'notes:archive',
    args: z.tuple([IdSchema]),
    handler: id => archiveNoteOperation({ id: createNoteId(id) }, repo),
  });

  defineIpcHandler({
    channel: 'notes:restore',
    args: z.tuple([IdSchema]),
    handler: id => restoreNoteOperation({ id: createNoteId(id) }, repo),
  });

  defineIpcHandler({
    channel: 'notes:duplicate',
    args: z.tuple([IdSchema]),
    handler: async id => {
      const result = await duplicateNoteOperation({ id: createNoteId(id) }, repo);
      if (result.ok) kickIndex();
      return result;
    },
  });

  defineIpcHandler({
    channel: 'notes:move',
    args: z.tuple([IdSchema, IdSchema]),
    handler: async (noteId, notebookId) => {
      const note = await repo.get(createNoteId(noteId));
      if (!note) {
        return { ok: false, error: { type: 'NOT_FOUND', id: noteId } };
      }
      const movedNote = moveNoteToNotebook(note, createNotebookId(notebookId));
      await repo.save(movedNote);
      return { ok: true, data: noteToSnapshot(movedNote) };
    },
  });

  defineIpcHandler({
    channel: 'notes:pin',
    args: z.tuple([IdSchema]),
    handler: async id => {
      const note = await repo.get(createNoteId(id));
      if (!note) return { ok: false, error: { type: 'NOT_FOUND', id } };
      const pinnedNote = pinNote(note);
      await repo.save(pinnedNote);
      return { ok: true, data: noteToSnapshot(pinnedNote) };
    },
  });

  defineIpcHandler({
    channel: 'notes:unpin',
    args: z.tuple([IdSchema]),
    handler: async id => {
      const note = await repo.get(createNoteId(id));
      if (!note) return { ok: false, error: { type: 'NOT_FOUND', id } };
      const unpinnedNote = unpinNote(note);
      await repo.save(unpinnedNote);
      return { ok: true, data: noteToSnapshot(unpinnedNote) };
    },
  });

  defineIpcHandler({
    channel: 'notes:softDelete',
    args: z.tuple([IdSchema]),
    handler: async id => {
      const note = await repo.get(createNoteId(id));
      if (!note) return { ok: false, error: { type: 'NOT_FOUND', id } };
      const deletedNote = softDeleteNote(note);
      await repo.save(deletedNote);
      return { ok: true, data: noteToSnapshot(deletedNote) };
    },
  });

  defineIpcHandler({
    channel: 'notes:restoreDeleted',
    args: z.tuple([IdSchema]),
    handler: async id => {
      const note = await repo.get(createNoteId(id));
      if (!note) return { ok: false, error: { type: 'NOT_FOUND', id } };
      const restoredNote = restoreDeletedNote(note);
      await repo.save(restoredNote);
      return { ok: true, data: noteToSnapshot(restoredNote) };
    },
  });

  defineIpcHandler({
    channel: 'notes:setStatus',
    args: z.tuple([IdSchema, StatusSchema]),
    handler: async (id, status) => {
      const note = await repo.get(createNoteId(id));
      if (!note) return { ok: false, error: { type: 'NOT_FOUND', id } };
      const updatedNote = setNoteStatus(note, status);
      await repo.save(updatedNote);
      return { ok: true, data: noteToSnapshot(updatedNote) };
    },
  });

  defineIpcHandler({
    channel: 'notes:list',
    args: z.tuple([ListNotesOptionsSchema.optional()]),
    handler: async options => {
      const notes = await repo.list(options);
      return notes.map(note => noteToSnapshot(note));
    },
  });

  defineIpcHandler({
    channel: 'notes:search',
    args: z.tuple([
      z.string().max(2048),
      z.union([z.number().int().positive().max(10000), ListNotesOptionsSchema]).optional(),
    ]),
    handler: async (query, limitOrOptions) => {
      if (typeof limitOrOptions === 'number' || limitOrOptions === undefined) {
        const notes = await repo.search(query, limitOrOptions);
        return notes.map(note => noteToSnapshot(note));
      }
      const notes = await repo.search(query, limitOrOptions.limit ?? 50, undefined, limitOrOptions);
      return notes.map(note => noteToSnapshot(note));
    },
  });

  // ── Tags ────────────────────────────────────────────────────────────────

  defineIpcHandler({
    channel: 'notes:tags',
    args: z.tuple([]),
    handler: () => repo.getAllTags(),
  });

  defineIpcHandler({
    channel: 'notes:setManualTags',
    args: z.tuple([IdSchema, z.array(TagSchema).max(256)]),
    handler: (noteId, tags) => {
      const id = createNoteId(noteId);
      const normalizedTags = [
        ...new Set(
          tags.map(t => t.trim().toLowerCase().replace(/^#/, '')).filter(t => t.length > 0)
        ),
      ];
      repo.setManualTags(
        id,
        normalizedTags.map(t => createTag(t))
      );
      return { ok: true };
    },
  });

  defineIpcHandler({
    channel: 'notes:getManualTags',
    args: z.tuple([IdSchema]),
    handler: noteId => repo.getManualTags(createNoteId(noteId)),
  });

  defineIpcHandler({
    channel: 'tags:listWithColors',
    args: z.tuple([]),
    handler: () => repo.getAllTagsWithColors(),
  });

  defineIpcHandler({
    channel: 'tags:query',
    args: z.tuple([
      z
        .object({
          filter: z.string().max(128).optional(),
          limit: z.number().int().min(0).max(10_000).optional(),
          offset: z.number().int().min(0).max(1_000_000).optional(),
          includeCount: z.boolean().optional(),
        })
        .optional(),
    ]),
    handler: options => repo.listTags(options ?? {}),
  });

  defineIpcHandler({
    channel: 'tags:setColor',
    args: z.tuple([TagSchema, z.string().max(32).nullable()]),
    handler: (tagName, color) => {
      repo.setTagColor(tagName, color);
      return { ok: true };
    },
  });

  defineIpcHandler({
    channel: 'tags:delete',
    args: z.tuple([TagSchema]),
    handler: tagName => {
      repo.deleteTag(tagName);
      return { ok: true };
    },
  });

  defineIpcHandler({
    channel: 'tags:rename',
    args: z.tuple([TagSchema, TagSchema]),
    handler: (oldName, newName) => repo.renameTag(oldName, newName),
  });

  // ── Links (Wikilinks / Backlinks) ───────────────────────────────────────

  defineIpcHandler({
    channel: 'links:sync',
    args: z.tuple([IdSchema, ContentSchema]),
    handler: (noteId, content) => {
      repo.syncLinks(createNoteId(noteId), content);
      return { ok: true };
    },
  });

  defineIpcHandler({
    channel: 'links:backlinks',
    args: z.tuple([IdSchema]),
    handler: noteId => repo.getBacklinks(createNoteId(noteId)),
  });

  defineIpcHandler({
    channel: 'links:outgoing',
    args: z.tuple([IdSchema]),
    handler: noteId => repo.getOutgoingLinks(createNoteId(noteId)),
  });

  defineIpcHandler({
    channel: 'links:graph',
    args: z.tuple([]),
    handler: () => {
      try {
        repo.rebuildAllLinks();
        return repo.getGraphData();
      } catch (error) {
        console.error('Failed to get graph data:', error);
        return { nodes: [], edges: [] };
      }
    },
  });

  // ── Embeds (File Resolution) ────────────────────────────────────────────

  // Embed targets are filenames inside an asset folder — restrict to
  // characters that can appear in a generated asset name (no slashes, no
  // path traversal). The relative-path check inside `join` would catch
  // most issues but rejecting at the boundary is cheaper.
  const EmbedTargetSchema = z
    .string()
    .min(1)
    .max(256)
    .regex(/^[a-zA-Z0-9._-]+$/);

  defineIpcHandler({
    channel: 'embeds:resolve',
    args: z.tuple([EmbedTargetSchema, IdSchema]),
    handler: (target, noteId) => {
      const assetPath = join(dataPaths.assets, noteId, target);
      return existsSync(assetPath) ? `asset://local/${noteId}/${target}` : null;
    },
  });

  defineIpcHandler({
    channel: 'embeds:resolveBatch',
    args: z.tuple([z.array(EmbedTargetSchema).max(1000), IdSchema]),
    handler: (targets, noteId): Record<string, string | null> => {
      const result: Record<string, string | null> = {};
      for (const target of targets) {
        const assetPath = join(dataPaths.assets, noteId, target);
        result[target] = existsSync(assetPath) ? `asset://local/${noteId}/${target}` : null;
      }
      return result;
    },
  });

  defineIpcHandler({
    channel: 'embeds:saveAsset',
    args: z.tuple([
      IdSchema.regex(/^[\w-]+$/),
      z.string().min(1).max(256),
      z.instanceof(ArrayBuffer),
      z.string().max(512).optional(),
    ]),
    handler: async (
      noteId,
      mime,
      bytes,
      originalName
    ): Promise<{ ok: true; filename: string; relPath: string } | { ok: false; error: string }> => {
      const MAX_SIZE = 20 * 1024 * 1024;
      if (bytes.byteLength > MAX_SIZE) {
        return { ok: false, error: 'File too large (max 20MB)' };
      }

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
        const match = originalName.match(/\.([a-zA-Z0-9]+)$/);
        ext = match?.[1]?.toLowerCase() ?? 'bin';
      }
      if (!ext) ext = 'bin';

      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const filename = `${timestamp}-${random}.${ext}`;

      const noteAssetsDir = join(dataPaths.assets, noteId);
      await mkdir(noteAssetsDir, { recursive: true });

      const assetPath = join(noteAssetsDir, filename);
      await writeFile(assetPath, Buffer.from(bytes));

      return { ok: true, filename, relPath: `${noteId}/${filename}` };
    },
  });

  // ── Stats / counts ──────────────────────────────────────────────────────

  defineIpcHandler({
    channel: 'notes:activityStats',
    args: z.tuple([]),
    handler: async () => {
      const allNotes = await repo.list({ archived: 'all', limit: 10000 });
      const now = Date.now();
      const fiftyTwoWeeksAgo = now - 52 * 7 * 24 * 60 * 60 * 1000;

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

      const weeks = Array.from(weekMap.entries())
        .map(([week, counts]) => ({ week, ...counts }))
        .sort((a, b) => a.week.localeCompare(b.week));

      const currentWeek = getISOWeek(new Date());
      let streak = 0;
      let checkDate = new Date();
      for (let i = 0; i < 52; i++) {
        const weekKey = getISOWeek(checkDate);
        const entry = weekMap.get(weekKey);
        if (entry && (entry.created > 0 || entry.updated > 0)) {
          streak++;
        } else if (i > 0) {
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
    },
  });

  defineIpcHandler({
    channel: 'notes:count',
    args: z.tuple([]),
    handler: () => repo.countSummary(),
  });

  defineIpcHandler({
    channel: 'notes:countScoped',
    args: z.tuple([ListNotesOptionsSchema.optional()]),
    handler: options => repo.countScoped(options),
  });
}

/** Get ISO week string (YYYY-Www) for a date */
function getISOWeek(date: Date): string {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
