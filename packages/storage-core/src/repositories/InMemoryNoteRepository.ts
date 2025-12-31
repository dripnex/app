/**
 * InMemoryNoteRepository
 *
 * In-memory implementation of ExtendedNoteRepository for testing.
 * No persistence - data is lost when the repository is garbage collected.
 */

import type { Note, NoteId, Tag } from '@readied/core';
import type { ExtendedNoteRepository } from '../interfaces/ExtendedNoteRepository.js';
import type { ListNotesOptions } from '../types/ListNotesOptions.js';
import type { ArchivedFilter } from '../types/ArchivedFilter.js';

/**
 * In-memory repository for testing purposes.
 * Implements the full ExtendedNoteRepository interface.
 */
export class InMemoryNoteRepository implements ExtendedNoteRepository {
  private notes = new Map<NoteId, Note>();

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
    const {
      limit = 50,
      offset = 0,
      tag,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      archived = 'active',
    } = options;

    let notes = Array.from(this.notes.values());

    // Filter by archived status
    notes = this.filterByArchived(notes, archived);

    // Filter by tag
    if (tag) {
      const lowerTag = tag.toLowerCase();
      notes = notes.filter(n =>
        n.metadata.tags.some(t => t.toLowerCase() === lowerTag)
      );
    }

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
    includeArchived: boolean = false
  ): Promise<Note[]> {
    const lowerQuery = query.toLowerCase();
    let notes = Array.from(this.notes.values());

    // Filter archived
    if (!includeArchived) {
      notes = notes.filter(n => n.metadata.archivedAt === null);
    }

    // Search in content and title
    notes = notes.filter(
      n =>
        n.content.toLowerCase().includes(lowerQuery) ||
        n.metadata.title.toLowerCase().includes(lowerQuery)
    );

    // Sort by updatedAt desc
    notes.sort((a, b) =>
      a.metadata.updatedAt > b.metadata.updatedAt ? -1 : 1
    );

    return notes.slice(0, limit);
  }

  /** Get total count of notes */
  async count(includeArchived: boolean = false): Promise<number> {
    if (includeArchived) {
      return this.notes.size;
    }
    return Array.from(this.notes.values()).filter(
      n => n.metadata.archivedAt === null
    ).length;
  }

  /** Get count of archived notes */
  async countArchived(): Promise<number> {
    return Array.from(this.notes.values()).filter(
      n => n.metadata.archivedAt !== null
    ).length;
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
