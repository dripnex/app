import { describe, it, expect, beforeEach } from 'vitest';
import { createNote, createNoteId, createNotebookId } from '@dripnex/core';
import { InMemoryNoteRepository } from '../src/repositories/InMemoryNoteRepository.js';

describe('InMemoryNoteRepository', () => {
  let repository: InMemoryNoteRepository;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
  });

  describe('basic CRUD', () => {
    it('saves and retrieves a note', async () => {
      const note = createNote({ content: '# Test Note' });
      await repository.save(note);

      const retrieved = await repository.get(note.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.content).toBe('# Test Note');
    });

    it('returns null for non-existent note', async () => {
      const result = await repository.get(createNoteId('non-existent'));
      expect(result).toBeNull();
    });

    it('deletes a note', async () => {
      const note = createNote({ content: '# To Delete' });
      await repository.save(note);
      expect(repository.size()).toBe(1);

      await repository.delete(note.id);
      expect(repository.size()).toBe(0);
    });

    it('finds a live note by title', async () => {
      const note = createNote({ content: '# Graph Target' });
      await repository.save(note);
      const found = await repository.findByTitle('graph target');
      expect(found?.id).toBe(note.id);
    });

    it('builds a graph from recorded links', async () => {
      const a = createNote({ content: '# Alpha' });
      const b = createNote({ content: '# Beta' });
      await repository.save(a);
      await repository.save(b);
      repository.addLink(a.id, 'Beta');

      const graph = repository.getGraphData();
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toEqual([{ source: a.id, target: b.id }]);
      expect(repository.getBacklinks(b.id)).toEqual([
        { noteId: a.id, noteTitle: a.title, targetRef: 'Beta' },
      ]);
    });

    it('updates an existing note', async () => {
      const note = createNote({ id: createNoteId('test-id'), content: '# Original' });
      await repository.save(note);

      const updated = { ...note, content: '# Updated' };
      await repository.save(updated);

      const retrieved = await repository.get(note.id);
      expect(retrieved?.content).toBe('# Updated');
      expect(repository.size()).toBe(1);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create multiple notes with different dates
      const note1 = createNote({ id: createNoteId('note-1'), content: '# First' });
      const note2 = createNote({ id: createNoteId('note-2'), content: '# Second' });
      const note3 = createNote({ id: createNoteId('note-3'), content: '# Third' });

      await repository.save(note1);
      await repository.save(note2);
      await repository.save(note3);
    });

    it('lists all notes', async () => {
      const notes = await repository.list();
      expect(notes.length).toBe(3);
    });

    it('respects limit', async () => {
      const notes = await repository.list({ limit: 2 });
      expect(notes.length).toBe(2);
    });

    it('respects offset', async () => {
      const notes = await repository.list({ offset: 1, limit: 10 });
      expect(notes.length).toBe(2);
    });

    it('filters by notebookId, status, pin, and tags AND', async () => {
      const nbA = createNotebookId('nb-a');
      const nbB = createNotebookId('nb-b');

      await repository.save(
        createNote({
          id: createNoteId('a1'),
          notebookId: nbA,
          content: '# A1 #work #shared',
          status: 'completed',
          isPinned: true,
        })
      );
      await repository.save(
        createNote({
          id: createNoteId('a2'),
          notebookId: nbA,
          content: '# A2 #work',
          isDeleted: true,
        })
      );
      await repository.save(
        createNote({
          id: createNoteId('b1'),
          notebookId: nbB,
          content: '# B1 #work #shared',
        })
      );

      const byNotebook = await repository.list({ notebookId: nbA, archived: 'all' });
      expect(byNotebook.map(n => n.id).sort()).toEqual(['a1', 'a2']);

      const excluded = await repository.list({ excludeNotebookIds: [nbA], archived: 'all' });
      expect(excluded.every(n => n.notebookId !== nbA)).toBe(true);
      expect(excluded.some(n => n.id === 'b1')).toBe(true);

      const pinned = await repository.list({ isPinned: true, archived: 'all' });
      expect(pinned.map(n => n.id)).toEqual(['a1']);

      const completed = await repository.list({ status: 'completed', archived: 'all' });
      expect(completed.map(n => n.id)).toEqual(['a1']);

      const andTags = await repository.list({ tags: ['work', 'shared'], archived: 'all' });
      expect(andTags.map(n => n.id).sort()).toEqual(['a1', 'b1']);

      const deleted = await repository.list({ isDeleted: true, archived: 'all' });
      expect(deleted.map(n => n.id)).toEqual(['a2']);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await repository.save(createNote({ content: '# Hello World' }));
      await repository.save(createNote({ content: '# Goodbye World' }));
      await repository.save(createNote({ content: '# Something Else' }));
    });

    it('searches by content', async () => {
      const results = await repository.search('World');
      expect(results.length).toBe(2);
    });

    it('is case insensitive', async () => {
      const results = await repository.search('world');
      expect(results.length).toBe(2);
    });

    it('returns empty for no matches', async () => {
      const results = await repository.search('xyz123');
      expect(results.length).toBe(0);
    });
  });

  describe('count', () => {
    it('counts notes', async () => {
      expect(await repository.count()).toBe(0);

      await repository.save(createNote({ content: '# One' }));
      expect(await repository.count()).toBe(1);

      await repository.save(createNote({ content: '# Two' }));
      expect(await repository.count()).toBe(2);
    });
  });

  describe('archived notes', () => {
    it('filters active notes by default', async () => {
      const active = createNote({ content: '# Active' });
      const archived = {
        ...createNote({ content: '# Archived' }),
        metadata: {
          ...createNote({ content: '# Archived' }).metadata,
          archivedAt: new Date().toISOString() as any,
        },
      };

      await repository.save(active);
      await repository.save(archived);

      const listed = await repository.list({ archived: 'active' });
      expect(listed.length).toBe(1);
      expect(listed[0].content).toBe('# Active');
    });

    it('can list only archived notes', async () => {
      const active = createNote({ content: '# Active' });
      const archived = {
        ...createNote({ content: '# Archived' }),
        metadata: {
          ...createNote({ content: '# Archived' }).metadata,
          archivedAt: new Date().toISOString() as any,
        },
      };

      await repository.save(active);
      await repository.save(archived);

      const listed = await repository.list({ archived: 'archived' });
      expect(listed.length).toBe(1);
      expect(listed[0].content).toBe('# Archived');
    });

    it('counts archived separately', async () => {
      const active = createNote({ content: '# Active' });
      const archived = {
        ...createNote({ content: '# Archived' }),
        metadata: {
          ...createNote({ content: '# Archived' }).metadata,
          archivedAt: new Date().toISOString() as any,
        },
      };

      await repository.save(active);
      await repository.save(archived);

      expect(await repository.count(false)).toBe(1);
      expect(await repository.countArchived()).toBe(1);
      expect(await repository.count(true)).toBe(2);
    });
  });
});
