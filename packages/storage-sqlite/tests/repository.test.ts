import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runMigrations } from '@dripnex/storage-core';
import { createNote, createNoteId } from '@dripnex/core';
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
});
