/**
 * ExtendedNoteRepository
 *
 * The query port the product actually uses. Core's NoteRepository is the
 * write port for domain operations (get/save/delete). This interface adds
 * list/search, counts, tags, backlinks, and the knowledge graph.
 *
 * Sync bookkeeping (needs_sync, push cursors) stays on the SQLite class.
 */

import type { Note, NoteId, Tag, NoteRepository } from '@dripnex/core';
import type { ListNotesOptions } from '../types/ListNotesOptions.js';
import type {
  BacklinkInfo,
  GraphData,
  NoteCountScoped,
  NoteCountSummary,
  OutgoingLinkInfo,
} from '../types/NoteQuery.js';

export interface ExtendedNoteRepository extends NoteRepository {
  list(options?: ListNotesOptions): Promise<Note[]>;

  search(
    query: string,
    limit?: number,
    includeArchived?: boolean,
    options?: ListNotesOptions
  ): Promise<Note[]>;

  count(includeArchived?: boolean): Promise<number>;
  countArchived(): Promise<number>;
  countSummary(): NoteCountSummary;
  countScoped(options?: ListNotesOptions): NoteCountScoped;

  getAllTags(includeArchived?: boolean): Promise<Tag[]>;
  getManualTags(noteId: NoteId): Tag[];
  setManualTags(noteId: NoteId, tags: readonly Tag[]): void;

  findByTitle(title: string): Promise<Note | null>;

  getBacklinks(noteId: NoteId): BacklinkInfo[];
  getOutgoingLinks(noteId: NoteId): OutgoingLinkInfo[];
  rebuildAllLinks(): number;
  getGraphData(): GraphData;
}
