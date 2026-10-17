/**
 * InMemoryNoteRepository
 *
 * In-memory implementation of ExtendedNoteRepository for testing.
 * No persistence - data is lost when the repository is garbage collected.
 */

import { createTag, type Note, type NoteId, type NoteStatus, type Tag } from '@dripnex/core';
import type { ExtendedNoteRepository } from '../interfaces/ExtendedNoteRepository.js';
import type { ListNotesOptions } from '../types/ListNotesOptions.js';
import type { ArchivedFilter } from '../types/ArchivedFilter.js';
import type {
  BacklinkInfo,
  GraphData,
  NoteCountScoped,
  NoteCountSummary,
  OutgoingLinkInfo,
} from '../types/NoteQuery.js';

/**
 * In-memory repository for testing purposes.
 * Implements the full ExtendedNoteRepository interface.
 */
export class InMemoryNoteRepository implements ExtendedNoteRepository {
  private notes = new Map<NoteId, Note>();
  private manualTags = new Map<NoteId, Tag[]>();
  /** sourceId → outgoing refs (titles). In-memory graph is title-resolved. */
  private links = new Map<NoteId, string[]>();
  private tagColors = new Map<string, string | null>();

  /** Get a note by ID */
  async get(id: NoteId): Promise<Note | null> {
    return this.notes.get(id) ?? null;
  }

  /** Save a note (insert or update) */
  async save(note: Note): Promise<void> {
    this.notes.set(note.id, note);
  }

  /** Delete a note by ID */
  async delete(id: NoteId): Promise<void> {
    this.notes.delete(id);
  }

  /** List notes with filtering and pagination */
  async list(options: ListNotesOptions = {}): Promise<Note[]> {
    const { limit = 50, offset = 0, sortBy = 'updatedAt', sortOrder = 'desc' } = options;

    const notes = this.applyFilters(Array.from(this.notes.values()), options);

    // Sort
    notes.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortBy) {
        case 'createdAt':
          aVal = a.metadata.createdAt;
          bVal = b.metadata.createdAt;
          break;
        case 'updatedAt':
          aVal = a.metadata.updatedAt;
          bVal = b.metadata.updatedAt;
          break;
        case 'title':
          aVal = a.metadata.title.toLowerCase();
          bVal = b.metadata.title.toLowerCase();
          break;
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    // Paginate
    return notes.slice(offset, offset + limit);
  }

  /** Search notes by content/title */
  async search(
    query: string,
    limit: number = 20,
    includeArchived: boolean = false,
    options: ListNotesOptions = {}
  ): Promise<Note[]> {
    const lowerQuery = query.toLowerCase();
    let notes = this.applyFilters(
      Array.from(this.notes.values()),
      {
        ...options,
        archived: options.archived ?? (includeArchived ? 'all' : 'active'),
      },
      { defaultExcludeDeleted: true }
    );

    // Search in content and title
    notes = notes.filter(
      n =>
        n.content.toLowerCase().includes(lowerQuery) ||
        n.metadata.title.toLowerCase().includes(lowerQuery)
    );

    // Sort by updatedAt desc
    notes.sort((a, b) => (a.metadata.updatedAt > b.metadata.updatedAt ? -1 : 1));

    return notes.slice(0, limit);
  }

  /** Get total count of notes */
  async count(includeArchived: boolean = false): Promise<number> {
    if (includeArchived) {
      return this.notes.size;
    }
    return Array.from(this.notes.values()).filter(n => n.metadata.archivedAt === null).length;
  }

  /** Get count of archived notes */
  async countArchived(): Promise<number> {
    return Array.from(this.notes.values()).filter(n => n.metadata.archivedAt !== null).length;
  }

  countSummary(): NoteCountSummary {
    const all = Array.from(this.notes.values());
    const byStatus: Record<NoteStatus, number> = {
      active: 0,
      on_hold: 0,
      completed: 0,
      dropped: 0,
    };
    const byNotebook: Record<string, number> = {};
    let archived = 0;
    let pinned = 0;
    let deleted = 0;
    for (const n of all) {
      byStatus[n.status] += 1;
      if (n.metadata.archivedAt) archived += 1;
      if (n.isPinned) pinned += 1;
      if (n.isDeleted) deleted += 1;
      if (!n.isDeleted && !n.metadata.archivedAt) {
        byNotebook[n.notebookId] = (byNotebook[n.notebookId] ?? 0) + 1;
      }
    }
    return {
      total: all.length,
      active: all.length - archived,
      archived,
      pinned,
      deleted,
      byStatus,
      byNotebook,
    };
  }

  countScoped(options: ListNotesOptions = {}): NoteCountScoped {
    const notes = this.applyFilters(Array.from(this.notes.values()), options);
    const byStatus: Record<NoteStatus, number> = {
      active: 0,
      on_hold: 0,
      completed: 0,
      dropped: 0,
    };
    const byTag: Record<string, number> = {};
    for (const n of notes) {
      byStatus[n.status] += 1;
      for (const tag of n.metadata.tags) {
        byTag[tag] = (byTag[tag] ?? 0) + 1;
      }
    }
    return { total: notes.length, byStatus, byTag };
  }

  getManualTags(noteId: NoteId): Tag[] {
    return this.manualTags.get(noteId) ?? [];
  }

  setManualTags(noteId: NoteId, tags: readonly Tag[]): void {
    this.manualTags.set(noteId, [...tags]);
  }

  async findByTitle(title: string): Promise<Note | null> {
    const needle = title.trim().toLowerCase();
    for (const note of this.notes.values()) {
      if (!note.isDeleted && !note.metadata.archivedAt && note.title.toLowerCase() === needle) {
        return note;
      }
    }
    return null;
  }

  getBacklinks(noteId: NoteId): BacklinkInfo[] {
    const target = this.notes.get(noteId);
    if (!target) return [];
    const title = target.title.toLowerCase();
    const out: BacklinkInfo[] = [];
    for (const [sourceId, refs] of this.links) {
      if (refs.some(r => r.toLowerCase() === title)) {
        const source = this.notes.get(sourceId);
        if (source && !source.isDeleted) {
          out.push({ noteId: source.id, noteTitle: source.title, targetRef: target.title });
        }
      }
    }
    return out;
  }

  getOutgoingLinks(noteId: NoteId): OutgoingLinkInfo[] {
    const refs = this.links.get(noteId) ?? [];
    return refs.map(targetRef => {
      const match = Array.from(this.notes.values()).find(
        n => !n.isDeleted && n.title.toLowerCase() === targetRef.toLowerCase()
      );
      return {
        targetRef,
        targetNoteId: match?.id ?? null,
        targetTitle: match?.title ?? null,
      };
    });
  }

  rebuildAllLinks(): number {
    this.links.clear();
    return this.notes.size;
  }

  /** Re-derive outgoing wikilink refs for a note from its content. */
  syncLinks(noteId: NoteId, content: string): void {
    const refs = Array.from(content.matchAll(/\[\[([^\]|#]+)/g), m => (m[1] ?? '').trim()).filter(
      Boolean
    );
    this.links.set(noteId, refs);
  }

  /** Test helper: record a wikilink from source to a title. */
  addLink(sourceId: NoteId, targetRef: string): void {
    const existing = this.links.get(sourceId) ?? [];
    existing.push(targetRef);
    this.links.set(sourceId, existing);
  }

  getGraphData(): GraphData {
    const live = Array.from(this.notes.values()).filter(
      n => !n.isDeleted && !n.metadata.archivedAt
    );
    const nodes = live.map(n => ({
      id: n.id,
      title: n.title,
      notebookId: n.notebookId,
      status: n.status,
      tags: [...n.metadata.tags],
    }));
    const idByTitle = new Map(live.map(n => [n.title.toLowerCase(), n.id]));
    const edges: Array<{ source: string; target: string }> = [];
    for (const [sourceId, refs] of this.links) {
      for (const ref of refs) {
        const target = idByTitle.get(ref.toLowerCase());
        if (target) edges.push({ source: sourceId, target });
      }
    }
    return { nodes, edges };
  }

  /** Get all unique tags */
  async getAllTags(includeArchived: boolean = false): Promise<Tag[]> {
    const tagSet = new Set<Tag>();
    const notes = includeArchived
      ? Array.from(this.notes.values())
      : Array.from(this.notes.values()).filter(n => n.metadata.archivedAt === null);

    for (const note of notes) {
      for (const tag of note.metadata.tags) {
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet).sort();
  }

  deleteTag(tagName: string): void {
    const normalized = tagName.trim().toLowerCase();
    this.tagColors.delete(normalized);
    for (const [noteId, tags] of this.manualTags) {
      this.manualTags.set(
        noteId,
        tags.filter(t => t.toLowerCase() !== normalized)
      );
    }
  }

  getAllTagsWithColors(): Array<{ name: string; color: string | null }> {
    return this.listTags();
  }

  listTags(
    query: {
      filter?: string;
      limit?: number;
      offset?: number;
      includeCount?: boolean;
    } = {}
  ): Array<{ name: string; color: string | null; count?: number }> {
    const filter = query.filter?.trim().toLowerCase() ?? '';
    const counts = new Map<string, number>();
    for (const note of this.notes.values()) {
      for (const tag of note.metadata.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    const names = new Set<string>([...counts.keys(), ...this.tagColors.keys()]);
    const tags = Array.from(names)
      .filter(name => !filter || name.toLowerCase().includes(filter))
      .sort()
      .map(name => ({
        name,
        color: this.tagColors.get(name) ?? null,
        ...(query.includeCount ? { count: counts.get(name) ?? 0 } : {}),
      }));
    const offset = Math.max(0, query.offset ?? 0);
    const limit = query.limit ?? tags.length;
    return tags.slice(offset, offset + limit);
  }

  setTagColor(tagName: string, color: string | null): void {
    const normalized = tagName.trim().toLowerCase();
    if (!normalized) return;
    this.tagColors.set(normalized, color);
  }

  renameTag(oldName: string, newName: string): { ok: boolean; error?: string } {
    const normalizedOld = oldName.trim().toLowerCase();
    const normalizedNew = newName.trim().toLowerCase();
    if (!normalizedNew) {
      return { ok: false, error: 'New tag name cannot be empty' };
    }
    if (normalizedOld === normalizedNew) {
      return { ok: true };
    }

    let found = false;
    for (const [noteId, tags] of this.manualTags) {
      if (tags.some(t => t.toLowerCase() === normalizedOld)) {
        found = true;
        this.manualTags.set(
          noteId,
          tags.map(t => (t.toLowerCase() === normalizedOld ? createTag(newName.trim()) : t))
        );
      }
    }
    if (this.tagColors.has(normalizedOld)) {
      found = true;
      const color = this.tagColors.get(normalizedOld) ?? null;
      this.tagColors.delete(normalizedOld);
      if (!this.tagColors.has(normalizedNew)) this.tagColors.set(normalizedNew, color);
    }
    if (!found) {
      return { ok: false, error: 'Tag not found' };
    }
    return { ok: true };
  }

  // Test helpers

  /** Get total size (for testing) */
  size(): number {
    return this.notes.size;
  }

  /** Clear all notes (for testing) */
  clear(): void {
    this.notes.clear();
  }

  // Private helpers

  private applyFilters(
    notes: Note[],
    options: ListNotesOptions,
    extras?: { defaultExcludeDeleted?: boolean }
  ): Note[] {
    const archived = options.archived ?? 'active';
    notes = this.filterByArchived(notes, archived);

    if (options.notebookIds !== undefined) {
      const allowed = new Set(options.notebookIds);
      notes = notes.filter(n => allowed.has(n.notebookId));
    } else if (options.notebookId !== undefined) {
      notes = notes.filter(n => n.notebookId === options.notebookId);
    }

    if (options.excludeNotebookIds && options.excludeNotebookIds.length > 0) {
      const excluded = new Set(options.excludeNotebookIds);
      notes = notes.filter(n => !excluded.has(n.notebookId));
    }

    if (options.status !== undefined) {
      notes = notes.filter(n => n.status === options.status);
    }

    if (options.isPinned !== undefined) {
      notes = notes.filter(n => n.isPinned === options.isPinned);
    }

    if (options.isDeleted !== undefined) {
      notes = notes.filter(n => n.isDeleted === options.isDeleted);
    } else if (extras?.defaultExcludeDeleted) {
      notes = notes.filter(n => !n.isDeleted);
    }

    const required = new Set<string>();
    if (options.tag) {
      const normalized = options.tag.trim().toLowerCase();
      if (normalized) required.add(normalized);
    }
    if (options.tags) {
      for (const tag of options.tags) {
        const normalized = tag.trim().toLowerCase();
        if (normalized) required.add(normalized);
      }
    }
    if (required.size > 0) {
      notes = notes.filter(n =>
        [...required].every(tag => n.metadata.tags.some(t => t.toLowerCase() === tag))
      );
    }

    return notes;
  }

  private filterByArchived(notes: Note[], filter: ArchivedFilter): Note[] {
    switch (filter) {
      case 'active':
        return notes.filter(n => n.metadata.archivedAt === null);
      case 'archived':
        return notes.filter(n => n.metadata.archivedAt !== null);
      case 'all':
        return notes;
    }
  }
}
