// packages/plugin-api/tests/createDataAPI.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createDataAPI } from '../src/data/createDataAPI';
import type { DataAPIBridge } from '../src/data/createDataAPI';
import { DataAccessError } from '../src/data/dataTypes';

function makeBridge(overrides: Partial<DataAPIBridge> = {}): DataAPIBridge {
  return {
    getNotes: async () => ({ notes: [], total: 0 }),
    getNote: async () => null,
    searchNotes: async () => ({ results: [], total: 0 }),
    countNotes: async () => 0,
    getNotebooks: async () => [],
    getNotebookTree: async () => [],
    getNotebook: async () => null,
    getTags: async () => [],
    getTagsWithColors: async () => [],
    getBacklinks: async () => [],
    getOutgoingLinks: async () => [],
    getGraphData: async () => ({ nodes: [], edges: [] }),
    ...overrides,
  };
}

describe('createDataAPI', () => {
  describe('getNotes', () => {
    it('delegates to bridge and computes hasMore', async () => {
      const notes = [{ id: '1', title: 'A', notebookId: 'nb', tags: [], wordCount: 10, createdAt: '', updatedAt: '', isPinned: false, status: 'active' }];
      const api = createDataAPI(makeBridge({ getNotes: async () => ({ notes, total: 5 }) }));
      const result = await api.getNotes({ limit: 2, offset: 0 });
      expect(result.notes).toEqual(notes);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
    });

    it('hasMore is false when all notes returned', async () => {
      const api = createDataAPI(makeBridge({ getNotes: async () => ({ notes: [{ id: '1', title: 'A', notebookId: 'nb', tags: [], wordCount: 0, createdAt: '', updatedAt: '', isPinned: false, status: 'active' }], total: 1 }) }));
      const result = await api.getNotes();
      expect(result.hasMore).toBe(false);
    });
  });

  describe('getNote', () => {
    it('returns note from bridge', async () => {
      const note = { id: '1', title: 'Test', content: 'body' };
      const api = createDataAPI(makeBridge({ getNote: async () => note }));
      expect(await api.getNote('1')).toEqual(note);
    });
  });

  describe('getNotebooks', () => {
    it('returns flat list by default', async () => {
      const notebooks = [{ id: 'nb-1', name: 'Inbox', parentId: null }];
      const api = createDataAPI(makeBridge({ getNotebooks: async () => notebooks }));
      const result = await api.getNotebooks();
      expect(result).toEqual(notebooks);
    });

    it('returns tree when tree option is true', async () => {
      const tree = [{ id: 'nb-1', name: 'Root', parentId: null, noteCount: 5, childCount: 1, children: [] }];
      const api = createDataAPI(makeBridge({ getNotebookTree: async () => tree }));
      const result = await api.getNotebooks({ tree: true });
      expect(result).toEqual(tree);
    });
  });

  describe('getTags', () => {
    it('returns simple tag names by default', async () => {
      const api = createDataAPI(makeBridge({ getTags: async () => ['js', 'react', 'vue'] }));
      const result = await api.getTags();
      expect(result).toEqual([{ name: 'js' }, { name: 'react' }, { name: 'vue' }]);
    });

    it('includes colors when requested', async () => {
      const api = createDataAPI(makeBridge({
        getTagsWithColors: async () => [{ name: 'js', color: '#ff0' }, { name: 'go', color: null }],
      }));
      const result = await api.getTags({ includeColors: true });
      expect(result).toEqual([{ name: 'js', color: '#ff0' }, { name: 'go', color: null }]);
    });

    it('filters by case-insensitive substring', async () => {
      const api = createDataAPI(makeBridge({ getTags: async () => ['JavaScript', 'Java', 'Python'] }));
      const result = await api.getTags({ filter: 'java' });
      expect(result.map(t => t.name)).toEqual(['JavaScript', 'Java']);
    });

    it('paginates with limit and offset', async () => {
      const api = createDataAPI(makeBridge({ getTags: async () => ['a', 'b', 'c', 'd', 'e'] }));
      const result = await api.getTags({ limit: 2, offset: 1 });
      expect(result.map(t => t.name)).toEqual(['b', 'c']);
    });
  });

  describe('getGraphData', () => {
    it('returns full graph without options', async () => {
      const graph = {
        nodes: [
          { id: '1', title: 'A', notebookId: 'nb-1' },
          { id: '2', title: 'B', notebookId: 'nb-2' },
        ],
        edges: [{ source: '1', target: '2' }],
      };
      const api = createDataAPI(makeBridge({ getGraphData: async () => graph }));
      const result = await api.getGraphData();
      expect(result).toEqual(graph);
    });

    it('filters by notebookId', async () => {
      const graph = {
        nodes: [
          { id: '1', title: 'A', notebookId: 'nb-1' },
          { id: '2', title: 'B', notebookId: 'nb-2' },
          { id: '3', title: 'C', notebookId: 'nb-1' },
        ],
        edges: [
          { source: '1', target: '2' },
          { source: '1', target: '3' },
        ],
      };
      const api = createDataAPI(makeBridge({ getGraphData: async () => graph }));
      const result = await api.getGraphData({ notebookId: 'nb-1' });
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toEqual({ source: '1', target: '3' });
    });
  });

  describe('error handling', () => {
    it('wraps bridge errors as DataAccessError', async () => {
      const api = createDataAPI(makeBridge({
        getNotes: async () => { throw new Error('IPC timeout'); },
      }));
      await expect(api.getNotes()).rejects.toThrow(DataAccessError);
      await expect(api.getNotes()).rejects.toThrow('[DataAPI.getNotes] IPC timeout');
    });

    it('wraps non-Error throws', async () => {
      const api = createDataAPI(makeBridge({
        getNote: async () => { throw 'string error'; },
      }));
      await expect(api.getNote('1')).rejects.toThrow('[DataAPI.getNote] string error');
    });
  });

  describe('events', () => {
    it('onNotesChanged fires when notified', () => {
      const api = createDataAPI(makeBridge());
      const cb = vi.fn();
      api.onNotesChanged(cb);
      api._notifyNotesChanged({ kind: 'note', action: 'created', id: '1' });
      expect(cb).toHaveBeenCalledWith({ kind: 'note', action: 'created', id: '1' });
    });

    it('onNotebooksChanged fires when notified', () => {
      const api = createDataAPI(makeBridge());
      const cb = vi.fn();
      api.onNotebooksChanged(cb);
      api._notifyNotebooksChanged({ kind: 'notebook', action: 'deleted', id: 'nb-1' });
      expect(cb).toHaveBeenCalledWith({ kind: 'notebook', action: 'deleted', id: 'nb-1' });
    });

    it('onTagsChanged fires with previousName for renames', () => {
      const api = createDataAPI(makeBridge());
      const cb = vi.fn();
      api.onTagsChanged(cb);
      api._notifyTagsChanged({ kind: 'tag', action: 'renamed', id: 'new-name', previousName: 'old-name' });
      expect(cb).toHaveBeenCalledWith({ kind: 'tag', action: 'renamed', id: 'new-name', previousName: 'old-name' });
    });

    it('unsubscribe stops listener', () => {
      const api = createDataAPI(makeBridge());
      const cb = vi.fn();
      const unsub = api.onNotesChanged(cb);
      unsub();
      api._notifyNotesChanged({ kind: 'note', action: 'updated', id: '1' });
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
