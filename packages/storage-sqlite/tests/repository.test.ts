import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runMigrations } from '@dripnex/storage-core';
import { createNote, createNoteId, createNotebookId, type Timestamp } from '@dripnex/core';
import { createInMemoryDatabase, type DatabaseConnection } from '../src/database.js';
import { allMigrations } from '../src/migrations/index.js';
import { SQLiteNoteRepository } from '../src/repositories/SQLiteNoteRepository.js';

describe('SQLiteNoteRepository', () => {
  let db: DatabaseConnection;
  let repository: SQLiteNoteRepository;

  beforeEach(() => {
    db = createInMemoryDatabase();
    runMigrations(db, allMigrations);
    repository = new SQLiteNoteRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('save and get', () => {
    it('saves and retrieves a note', async () => {
      const note = createNote({
        id: createNoteId('test-1'),
        content: '# Hello World\n\nThis is a test note.',
      });

      await repository.save(note);
      const retrieved = await repository.get(note.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(note.id);
      expect(retrieved!.content).toBe(note.content);
      expect(retrieved!.metadata.title).toBe('Hello World');
    });

    it('returns null for non-existent note', async () => {
      const result = await repository.get(createNoteId('non-existent'));
      expect(result).toBeNull();
    });

    it('updates existing note on save', async () => {
      const note = createNote({
        id: createNoteId('update-test'),
        content: '# Original',
      });

      await repository.save(note);

      const updated = createNote({
        id: createNoteId('update-test'),
        content: '# Updated Content',
      });

      await repository.save(updated);

      const retrieved = await repository.get(note.id);
      expect(retrieved!.metadata.title).toBe('Updated Content');
    });
  });

  describe('tags', () => {
    it('saves and retrieves tags', async () => {
      const note = createNote({
        id: createNoteId('tagged-note'),
        content: '# Test #javascript #react',
      });

      await repository.save(note);
      const retrieved = await repository.get(note.id);

      expect(retrieved!.metadata.tags).toContain('javascript');
      expect(retrieved!.metadata.tags).toContain('react');
    });

    it('updates tags on note update', async () => {
      const note = createNote({
        id: createNoteId('tag-update'),
        content: '# Test #old',
      });

      await repository.save(note);

      const updated = createNote({
        id: createNoteId('tag-update'),
        content: '# Test #new #fresh',
      });

      await repository.save(updated);

      const retrieved = await repository.get(note.id);
      expect(retrieved!.metadata.tags).not.toContain('old');
      expect(retrieved!.metadata.tags).toContain('new');
      expect(retrieved!.metadata.tags).toContain('fresh');
    });

    it('gets all unique tags', async () => {
      await repository.save(
        createNote({
          id: createNoteId('n1'),
          content: '# Note 1 #javascript #react',
        })
      );

      await repository.save(
        createNote({
          id: createNoteId('n2'),
          content: '# Note 2 #javascript #vue',
        })
      );

      const tags = await repository.getAllTags();
      expect(tags).toContain('javascript');
      expect(tags).toContain('react');
      expect(tags).toContain('vue');
      expect(tags.length).toBe(3);
    });
  });

  describe('delete', () => {
    it('deletes a note', async () => {
      const note = createNote({
        id: createNoteId('delete-me'),
        content: '# To Delete',
      });

      await repository.save(note);
      expect(await repository.get(note.id)).not.toBeNull();

      await repository.delete(note.id);
      expect(await repository.get(note.id)).toBeNull();
    });

    it('handles deleting non-existent note gracefully', async () => {
      // Should not throw
      await repository.delete(createNoteId('non-existent'));
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create test notes
      for (let i = 1; i <= 5; i++) {
        const note = createNote({
          id: createNoteId(`note-${i}`),
          content: `# Note ${i}\n\n#common ${i % 2 === 0 ? '#even' : '#odd'}`,
        });
        await repository.save(note);
      }
    });

    it('lists all notes with default pagination', async () => {
      const notes = await repository.list();
      expect(notes.length).toBe(5);
    });

    it('respects limit', async () => {
      const notes = await repository.list({ limit: 2 });
      expect(notes.length).toBe(2);
    });

    it('respects offset', async () => {
      const allNotes = await repository.list();
      const offsetNotes = await repository.list({ offset: 2 });

      expect(offsetNotes.length).toBe(3);
      expect(offsetNotes[0].id).toBe(allNotes[2].id);
    });

    it('filters by tag', async () => {
      const evenNotes = await repository.list({ tag: 'even' });
      expect(evenNotes.length).toBe(2);
    });

    it('sorts by title ascending', async () => {
      const notes = await repository.list({ sortBy: 'title', sortOrder: 'asc' });
      expect(notes[0].metadata.title).toBe('Note 1');
      expect(notes[4].metadata.title).toBe('Note 5');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await repository.save(
        createNote({
          id: createNoteId('js-note'),
          content: '# JavaScript Guide\n\nLearn JavaScript basics.',
        })
      );

      await repository.save(
        createNote({
          id: createNoteId('ts-note'),
          content: '# TypeScript Guide\n\nLearn TypeScript.',
        })
      );

      await repository.save(
        createNote({
          id: createNoteId('python-note'),
          content: '# Python Guide\n\nLearn Python basics.',
        })
      );
    });

    it('searches by content', async () => {
      const results = await repository.search('JavaScript');
      expect(results.length).toBe(1);
      expect(results[0].metadata.title).toBe('JavaScript Guide');
    });

    it('searches by title', async () => {
      const results = await repository.search('Guide');
      expect(results.length).toBe(3);
    });

    it('respects limit', async () => {
      const results = await repository.search('Guide', 1);
      expect(results.length).toBe(1);
    });

    it('returns empty for no matches', async () => {
      const results = await repository.search('Rust');
      expect(results.length).toBe(0);
    });
  });

  describe('count', () => {
    it('returns correct count', async () => {
      expect(await repository.count()).toBe(0);

      await repository.save(createNote({ id: createNoteId('n1'), content: '# 1' }));
      expect(await repository.count()).toBe(1);

      await repository.save(createNote({ id: createNoteId('n2'), content: '# 2' }));
      expect(await repository.count()).toBe(2);

      await repository.delete(createNoteId('n1'));
      expect(await repository.count()).toBe(1);
    });
  });

  describe('list filters', () => {
    const nbA = createNotebookId('nb-a');
    const nbB = createNotebookId('nb-b');
    const nbC = createNotebookId('nb-c');

    beforeEach(async () => {
      await repository.save(
        createNote({
          id: createNoteId('a-active'),
          notebookId: nbA,
          content: '# Active A\n\n#alpha #shared',
          status: 'active',
        })
      );
      await repository.save(
        createNote({
          id: createNoteId('a-pinned'),
          notebookId: nbA,
          content: '# Pinned A\n\n#alpha',
          isPinned: true,
          status: 'on_hold',
        })
      );
      await repository.save(
        createNote({
          id: createNoteId('a-deleted'),
          notebookId: nbA,
          content: '# Deleted A\n\n#alpha',
          isDeleted: true,
          status: 'dropped',
        })
      );
      await repository.save(
        createNote({
          id: createNoteId('b-done'),
          notebookId: nbB,
          content: '# Done B\n\n#beta #shared',
          status: 'completed',
        })
      );
      await repository.save(
        createNote({
          id: createNoteId('c-only'),
          notebookId: nbC,
          content: '# Only C\n\n#gamma',
        })
      );

      const archived = createNote({
        id: createNoteId('a-archived'),
        notebookId: nbA,
        content: '# Archived A\n\n#alpha',
      });
      await repository.save({
        ...archived,
        metadata: {
          ...archived.metadata,
          archivedAt: new Date().toISOString() as Timestamp,
        },
      });
    });

    it('filters by notebookId', async () => {
      const notes = await repository.list({ notebookId: nbA, archived: 'all', limit: 100 });
      expect(notes.map(n => n.id).sort()).toEqual(
        ['a-active', 'a-archived', 'a-deleted', 'a-pinned'].sort()
      );
    });

    it('excludes notebook ids', async () => {
      const notes = await repository.list({
        excludeNotebookIds: [nbA, nbC],
        archived: 'all',
        limit: 100,
      });
      expect(notes.map(n => n.id)).toEqual(['b-done']);
    });

    it('does not filter isDeleted when undefined', async () => {
      const notes = await repository.list({ notebookId: nbA, archived: 'all', limit: 100 });
      expect(notes.some(n => n.isDeleted)).toBe(true);
      expect(notes.some(n => !n.isDeleted)).toBe(true);
    });

    it('filters isDeleted when defined', async () => {
      const deleted = await repository.list({
        notebookId: nbA,
        isDeleted: true,
        archived: 'all',
        limit: 100,
      });
      expect(deleted.map(n => n.id)).toEqual(['a-deleted']);

      const notDeleted = await repository.list({
        notebookId: nbA,
        isDeleted: false,
        archived: 'all',
        limit: 100,
      });
      expect(notDeleted.every(n => !n.isDeleted)).toBe(true);
      expect(notDeleted).toHaveLength(3);
    });

    it('filters isPinned', async () => {
      const notes = await repository.list({ isPinned: true, archived: 'all', limit: 100 });
      expect(notes.map(n => n.id)).toEqual(['a-pinned']);
    });

    it('filters by status', async () => {
      const notes = await repository.list({ status: 'completed', archived: 'all', limit: 100 });
      expect(notes.map(n => n.id)).toEqual(['b-done']);
    });

    it('filters tags with AND', async () => {
      const notes = await repository.list({
        tags: ['alpha', 'shared'],
        archived: 'all',
        limit: 100,
      });
      expect(notes.map(n => n.id)).toEqual(['a-active']);
    });

    it('combines tag and tags as AND', async () => {
      const notes = await repository.list({
        tag: 'beta',
        tags: ['shared'],
        archived: 'all',
        limit: 100,
      });
      expect(notes.map(n => n.id)).toEqual(['b-done']);
    });

    it('keeps default limit of 50', async () => {
      for (let i = 0; i < 55; i++) {
        await repository.save(
          createNote({
            id: createNoteId(`bulk-${i}`),
            content: `# Bulk ${i}`,
          })
        );
      }
      const notes = await repository.list({ archived: 'all' });
      expect(notes).toHaveLength(50);
    });
  });

  describe('search filters', () => {
    beforeEach(async () => {
      await repository.save(
        createNote({
          id: createNoteId('search-live'),
          notebookId: createNotebookId('nb-live'),
          content: '# Searchable Live\n\nUniqueToken lives here.',
        })
      );
      await repository.save(
        createNote({
          id: createNoteId('search-deleted'),
          notebookId: createNotebookId('nb-live'),
          content: '# Searchable Deleted\n\nUniqueToken is deleted.',
          isDeleted: true,
        })
      );
      await repository.save(
        createNote({
          id: createNoteId('search-other'),
          notebookId: createNotebookId('nb-other'),
          content: '# Searchable Other\n\nUniqueToken in another notebook.',
        })
      );
    });

    it('excludes deleted notes by default', async () => {
      const results = await repository.search('UniqueToken', 20);
      expect(results.map(n => n.id).sort()).toEqual(['search-live', 'search-other']);
    });

    it('returns only deleted notes when isDeleted is true', async () => {
      const results = await repository.search('UniqueToken', 20, false, { isDeleted: true });
      expect(results.map(n => n.id)).toEqual(['search-deleted']);
    });

    it('applies notebookId filter', async () => {
      const results = await repository.search('UniqueToken', 20, false, {
        notebookId: 'nb-live',
      });
      expect(results.map(n => n.id)).toEqual(['search-live']);
    });
  });

  describe('countSummary', () => {
    it('counts more than 50 notes and matches JS semantics', async () => {
      const nbA = createNotebookId('nb-a');
      const nbB = createNotebookId('nb-b');

      for (let i = 0; i < 52; i++) {
        await repository.save(
          createNote({
            id: createNoteId(`plain-${i}`),
            notebookId: nbA,
            content: `# Plain ${i}`,
            status: 'active',
          })
        );
      }

      await repository.save(
        createNote({
          id: createNoteId('deleted-active'),
          notebookId: nbA,
          content: '# Deleted',
          isDeleted: true,
          status: 'on_hold',
        })
      );
      await repository.save(
        createNote({
          id: createNoteId('pinned-deleted'),
          notebookId: nbB,
          content: '# Pinned Deleted',
          isPinned: true,
          isDeleted: true,
          status: 'completed',
        })
      );
      await repository.save(
        createNote({
          id: createNoteId('pinned-live'),
          notebookId: nbB,
          content: '# Pinned Live',
          isPinned: true,
          status: 'dropped',
        })
      );

      const archived = createNote({
        id: createNoteId('archived-live'),
        notebookId: nbB,
        content: '# Archived',
        status: 'active',
      });
      await repository.save({
        ...archived,
        metadata: {
          ...archived.metadata,
          archivedAt: new Date().toISOString() as Timestamp,
        },
      });

      const summary = repository.countSummary();

      // 52 plain + deleted + pinned-deleted + pinned-live + archived = 56
      expect(summary.total).toBe(56);
      expect(summary.active).toBe(55); // all except archived
      expect(summary.archived).toBe(1);
      expect(summary.pinned).toBe(2); // includes deleted
      expect(summary.deleted).toBe(2);
      expect(summary.byStatus).toEqual({
        active: 53, // 52 plain + archived
        on_hold: 1,
        completed: 1,
        dropped: 1,
      });
      expect(summary.byNotebook).toEqual({
        'nb-a': 52, // deleted excluded
        'nb-b': 1, // only pinned-live
      });
    });
  });

  describe('countScoped', () => {
    beforeEach(async () => {
      const nbA = createNotebookId('nb-a');
      const nbB = createNotebookId('nb-b');

      await repository.save(
        createNote({
          id: createNoteId('scoped-a1'),
          notebookId: nbA,
          content: '# A1\n\n#work #shared',
          status: 'active',
        })
      );
      await repository.save(
        createNote({
          id: createNoteId('scoped-a2'),
          notebookId: nbA,
          content: '# A2\n\n#work',
          status: 'completed',
        })
      );
      await repository.save(
        createNote({
          id: createNoteId('scoped-b1'),
          notebookId: nbB,
          content: '# B1\n\n#home',
          status: 'active',
        })
      );
      await repository.save(
        createNote({
          id: createNoteId('scoped-deleted'),
          notebookId: nbA,
          content: '# Deleted\n\n#work',
          isDeleted: true,
          status: 'dropped',
        })
      );
    });

    it('counts under the same WHERE as list', async () => {
      const listed = await repository.list({ notebookId: 'nb-a', archived: 'active', limit: 100 });
      const scoped = repository.countScoped({ notebookId: 'nb-a' });

      expect(scoped.total).toBe(listed.length);
      expect(scoped.total).toBe(3); // includes deleted (isDeleted undefined)
      expect(scoped.byStatus).toEqual({
        active: 1,
        on_hold: 0,
        completed: 1,
        dropped: 1,
      });
      expect(scoped.byTag).toEqual({
        work: 3,
        shared: 1,
      });
    });

    it('respects isDeleted and ignores limit', async () => {
      const scoped = repository.countScoped({
        notebookId: 'nb-a',
        isDeleted: false,
        limit: 1,
      });
      expect(scoped.total).toBe(2);
      expect(scoped.byStatus).toEqual({
        active: 1,
        on_hold: 0,
        completed: 1,
        dropped: 0,
      });
      expect(scoped.byTag).toEqual({
        work: 2,
        shared: 1,
      });
    });
  });
});
