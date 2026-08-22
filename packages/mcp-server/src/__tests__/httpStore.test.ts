import { describe, expect, it, vi } from 'vitest';
import type { LocalHttpClient } from '../http';
import { HttpStore } from '../httpStore';

function stubClient(partial: Partial<LocalHttpClient>): LocalHttpClient {
  return partial as LocalHttpClient;
}

describe('HttpStore', () => {
  it('lists notes from GET /api/notes and applies limit', async () => {
    const listNotes = vi.fn(async () => [
      { id: 'a', title: 'A', excerpt: 'one', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b', title: 'B', excerpt: 'two', updatedAt: '2026-01-02T00:00:00.000Z' },
    ]);
    const store = new HttpStore(stubClient({ listNotes }));
    const rows = await store.listNotes({
      limit: 1,
      includeTrash: false,
    });
    expect(rows).toEqual([
      { id: 'a', title: 'A', updated_at: '2026-01-01T00:00:00.000Z', excerpt: 'one' },
    ]);
  });

  it('creates a note via POST and derives the title from content', async () => {
    const createNote = vi.fn(async () => ({ id: 'n1' }));
    const store = new HttpStore(stubClient({ createNote }));
    await expect(store.createNote({ content: '# Hello\n\nBody' })).resolves.toEqual({
      id: 'n1',
      title: 'Hello',
    });
    expect(createNote).toHaveBeenCalledWith({ content: '# Hello\n\nBody' });
  });

  it('trashes with DELETE and passes permanent through', async () => {
    const deleteNote = vi.fn(async () => true);
    const store = new HttpStore(stubClient({ deleteNote }));
    await expect(store.trashNote('n1')).resolves.toBe(true);
    expect(deleteNote).toHaveBeenCalledWith('n1', false);
    await expect(store.trashNote('n1', true)).resolves.toBe(true);
    expect(deleteNote).toHaveBeenCalledWith('n1', true);
  });

  it('maps notebooks and tags onto /api/books and /api/tags', async () => {
    const createBook = vi.fn(async () => ({ id: 'work' }));
    const updateBook = vi.fn(async () => true);
    const deleteBook = vi.fn(async () => true);
    const createTag = vi.fn(async () => ({ ok: true, name: 'ship' }));
    const updateTag = vi.fn(async () => true);
    const getChanges = vi.fn(async () => ({
      results: [{ seq: 2, id: 'n1', kind: 'note' as const }],
      last_seq: 2,
    }));
    const store = new HttpStore(
      stubClient({ createBook, updateBook, deleteBook, createTag, updateTag, getChanges })
    );

    await expect(store.createNotebook({ name: 'Work' })).resolves.toEqual({ id: 'work' });
    await expect(store.updateNotebook('work', { name: 'Office' })).resolves.toBe(true);
    await expect(store.deleteNotebook('work')).resolves.toBe(true);
    await expect(store.createTag({ name: 'Ship' })).resolves.toEqual({ name: 'ship' });
    await expect(store.updateTag('ship', { newName: 'shipped' })).resolves.toBe(true);
    expect(updateTag).toHaveBeenCalledWith('ship', { color: undefined, name: 'shipped' });
    await expect(store.getChanges(1)).resolves.toEqual({
      results: [{ seq: 2, id: 'n1', kind: 'note' }],
      last_seq: 2,
    });
  });

  it('finds a template by searching then reading the templates notebook', async () => {
    const listBooks = vi.fn(async () => [
      { id: 'templates', name: 'Templates', parentId: null, icon: null },
    ]);
    const searchNotes = vi.fn(async () => [
      { id: 't1', title: 'Meeting', excerpt: '', updatedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    const getNote = vi.fn(async () => ({
      id: 't1',
      title: 'Meeting',
      content: '---\ninstruction: Capture attendees.\n---\n# Meeting',
      notebookId: 'templates',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      tags: [],
      wordCount: 2,
      isPinned: false,
    }));
    const store = new HttpStore(stubClient({ listBooks, searchNotes, getNote }));
    await expect(store.findTemplate('Meeting')).resolves.toMatchObject({
      id: 't1',
      title: 'Meeting',
    });
  });
});
