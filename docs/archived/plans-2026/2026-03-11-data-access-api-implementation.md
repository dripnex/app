# Data Access API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated `context.data` namespace to the plugin API with rich query capabilities (filters, sorting, pagination, graph, events, error handling).

**Architecture:** A `DataAPI` interface with typed query options, backed by a `DataAPIBridge` that maps to existing `window.dripnex.*` IPC calls. The `createDataAPI()` factory handles option merging, error wrapping, and event dispatch. `AppAPI` stays unchanged for backward compat.

**Tech Stack:** TypeScript, Zustand patterns, Electron IPC, vitest

---

### Task 1: Data types — query options and result types

**Files:**

- Create: `packages/plugin-api/src/data/dataTypes.ts`
- Test: `packages/plugin-api/tests/dataTypes.test.ts`

**Context:** This file defines ALL types for the DataAPI. No logic, just interfaces and one error class. The existing `NoteInfo`, `NoteSummaryInfo`, `NotebookInfo` from `types.ts` are reused — we don't duplicate them.

**Step 1: Create the types file**

```typescript
// packages/plugin-api/src/data/dataTypes.ts

import type { NoteInfo, NoteSummaryInfo, NotebookInfo } from '../types';

// Re-export for convenience
export type { NoteInfo, NoteSummaryInfo, NotebookInfo };

// ── Query Options ───────────────────────────────────

export interface NoteQueryOptions {
  notebookId?: string;
  tag?: string;
  status?: string;
  isPinned?: boolean;
  sortBy?: 'title' | 'createdAt' | 'updatedAt' | 'wordCount';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface NoteQueryResult {
  notes: NoteSummaryInfo[];
  total: number;
  hasMore: boolean;
}

export interface SearchOptions {
  limit?: number;
  notebookId?: string;
}

export interface SearchResult {
  results: Array<{ id: string; title: string; snippet?: string }>;
  total: number;
}

export interface NotebookQueryOptions {
  tree?: boolean;
  includeCounts?: boolean;
}

export interface NotebookDetailInfo extends NotebookInfo {
  noteCount: number;
  childCount: number;
}

export interface NotebookTreeNode extends NotebookDetailInfo {
  children: NotebookTreeNode[];
}

export type NotebookResult = NotebookInfo[] | NotebookTreeNode[];

export interface TagQueryOptions {
  includeColors?: boolean;
  includeCount?: boolean;
  /** Case-insensitive substring match on tag name */
  filter?: string;
  limit?: number;
  offset?: number;
}

export interface TagInfo {
  name: string;
  color?: string | null;
  count?: number;
}

export interface GraphQueryOptions {
  notebookId?: string;
  depth?: number;
}

export interface LinkInfo {
  noteId: string;
  noteTitle: string;
}

export interface OutgoingLinkInfo {
  targetId: string | null;
  targetTitle: string;
  resolved: boolean;
}

export interface GraphData {
  nodes: Array<{ id: string; title: string; notebookId: string }>;
  edges: Array<{ source: string; target: string }>;
}

// ── Events ──────────────────────────────────────────

export interface DataChangeEvent<T extends 'note' | 'notebook' | 'tag'> {
  kind: T;
  action: 'created' | 'updated' | 'deleted' | 'renamed';
  id: string;
  previousName?: string;
}

// ── Error ───────────────────────────────────────────

export class DataAccessError extends Error {
  constructor(
    public readonly method: string,
    message: string
  ) {
    super(`[DataAPI.${method}] ${message}`);
    this.name = 'DataAccessError';
  }
}
```

**Step 2: Write tests for DataAccessError**

```typescript
// packages/plugin-api/tests/dataTypes.test.ts
import { describe, it, expect } from 'vitest';
import { DataAccessError } from '../src/data/dataTypes';

describe('DataAccessError', () => {
  it('sets name to DataAccessError', () => {
    const err = new DataAccessError('getNotes', 'IPC failed');
    expect(err.name).toBe('DataAccessError');
  });

  it('includes method in message', () => {
    const err = new DataAccessError('getNotes', 'IPC failed');
    expect(err.message).toBe('[DataAPI.getNotes] IPC failed');
  });

  it('exposes method property', () => {
    const err = new DataAccessError('getGraphData', 'timeout');
    expect(err.method).toBe('getGraphData');
  });

  it('is an instance of Error', () => {
    const err = new DataAccessError('getTags', 'oops');
    expect(err).toBeInstanceOf(Error);
  });
});
```

**Step 3: Run tests**

Run: `cd packages/plugin-api && pnpm vitest run tests/dataTypes.test.ts`
Expected: 4 tests PASS

**Step 4: Commit**

```bash
git add packages/plugin-api/src/data/dataTypes.ts packages/plugin-api/tests/dataTypes.test.ts
git commit -m "feat(plugin-api): add DataAPI types, query options, and DataAccessError"
```

---

### Task 2: DataAPI interface and DataAPIBridge

**Files:**

- Create: `packages/plugin-api/src/data/createDataAPI.ts`
- Modify: `packages/plugin-api/src/types.ts:112-148` (add `data: DataAPI` to PluginContext)

**Context:** The `DataAPI` interface is what plugins see. The `DataAPIBridge` is what the host injects (thin IPC mapping). The `createDataAPI()` factory connects them with error wrapping and event dispatch.

**Step 1: Create the DataAPI interface and bridge**

```typescript
// packages/plugin-api/src/data/createDataAPI.ts
import type {
  NoteInfo,
  NoteQueryOptions,
  NoteQueryResult,
  SearchOptions,
  SearchResult,
  NotebookQueryOptions,
  NotebookResult,
  NotebookDetailInfo,
  TagQueryOptions,
  TagInfo,
  GraphQueryOptions,
  GraphData,
  LinkInfo,
  OutgoingLinkInfo,
  DataChangeEvent,
  DataAccessError,
} from './dataTypes';
import { DataAccessError as DataAccessErrorClass } from './dataTypes';

// ── Public interface (what plugins see) ─────────────

export interface DataAPI {
  getNotes(options?: NoteQueryOptions): Promise<NoteQueryResult>;
  getNote(id: string): Promise<NoteInfo | null>;
  searchNotes(query: string, options?: SearchOptions): Promise<SearchResult>;
  countNotes(options?: { notebookId?: string; tag?: string }): Promise<number>;

  getNotebooks(options?: NotebookQueryOptions): Promise<NotebookResult>;
  getNotebook(id: string): Promise<NotebookDetailInfo | null>;

  getTags(options?: TagQueryOptions): Promise<TagInfo[]>;

  getBacklinks(noteId: string): Promise<LinkInfo[]>;
  getOutgoingLinks(noteId: string): Promise<OutgoingLinkInfo[]>;
  getGraphData(options?: GraphQueryOptions): Promise<GraphData>;

  onNotesChanged(callback: (event: DataChangeEvent<'note'>) => void): () => void;
  onNotebooksChanged(callback: (event: DataChangeEvent<'notebook'>) => void): () => void;
  onTagsChanged(callback: (event: DataChangeEvent<'tag'>) => void): () => void;
}

// ── Extended with internal notify methods ───────────

export interface DataAPIWithEvents extends DataAPI {
  _notifyNotesChanged(event: DataChangeEvent<'note'>): void;
  _notifyNotebooksChanged(event: DataChangeEvent<'notebook'>): void;
  _notifyTagsChanged(event: DataChangeEvent<'tag'>): void;
}

// ── Bridge (injected by host, thin IPC wrapper) ─────

export interface DataAPIBridge {
  getNotes(
    options?: NoteQueryOptions
  ): Promise<{ notes: import('./dataTypes').NoteSummaryInfo[]; total: number }>;
  getNote(id: string): Promise<NoteInfo | null>;
  searchNotes(query: string, options?: SearchOptions): Promise<SearchResult>;
  countNotes(options?: { notebookId?: string; tag?: string }): Promise<number>;
  getNotebooks(): Promise<import('./dataTypes').NotebookInfo[]>;
  getNotebookTree(): Promise<import('./dataTypes').NotebookTreeNode[]>;
  getNotebook(id: string): Promise<NotebookDetailInfo | null>;
  getTags(): Promise<string[]>;
  getTagsWithColors(): Promise<Array<{ name: string; color: string | null }>>;
  getBacklinks(noteId: string): Promise<LinkInfo[]>;
  getOutgoingLinks(noteId: string): Promise<OutgoingLinkInfo[]>;
  getGraphData(): Promise<GraphData>;
}

// ── Error wrapper ───────────────────────────────────

async function safeBridgeCall<T>(fn: () => Promise<T>, method: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new DataAccessErrorClass(method, message);
  }
}

// ── Factory ─────────────────────────────────────────

export function createDataAPI(bridge: DataAPIBridge): DataAPIWithEvents {
  const notesChangedListeners = new Set<(e: DataChangeEvent<'note'>) => void>();
  const notebooksChangedListeners = new Set<(e: DataChangeEvent<'notebook'>) => void>();
  const tagsChangedListeners = new Set<(e: DataChangeEvent<'tag'>) => void>();

  return {
    // ── Notes ─────────────────────────────────────
    async getNotes(options) {
      const { notes, total } = await safeBridgeCall(() => bridge.getNotes(options), 'getNotes');
      const limit = options?.limit ?? 50;
      const offset = options?.offset ?? 0;
      return { notes, total, hasMore: offset + notes.length < total };
    },

    async getNote(id) {
      return safeBridgeCall(() => bridge.getNote(id), 'getNote');
    },

    async searchNotes(query, options) {
      return safeBridgeCall(() => bridge.searchNotes(query, options), 'searchNotes');
    },

    async countNotes(options) {
      return safeBridgeCall(() => bridge.countNotes(options), 'countNotes');
    },

    // ── Notebooks ─────────────────────────────────
    async getNotebooks(options) {
      if (options?.tree) {
        return safeBridgeCall(() => bridge.getNotebookTree(), 'getNotebooks');
      }
      return safeBridgeCall(() => bridge.getNotebooks(), 'getNotebooks');
    },

    async getNotebook(id) {
      return safeBridgeCall(() => bridge.getNotebook(id), 'getNotebook');
    },

    // ── Tags ──────────────────────────────────────
    async getTags(options) {
      let tags: TagInfo[];

      if (options?.includeColors) {
        const raw = await safeBridgeCall(() => bridge.getTagsWithColors(), 'getTags');
        tags = raw.map(t => ({ name: t.name, color: t.color }));
      } else {
        const raw = await safeBridgeCall(() => bridge.getTags(), 'getTags');
        tags = raw.map(name => ({ name }));
      }

      // Client-side filter (case-insensitive substring)
      if (options?.filter) {
        const lower = options.filter.toLowerCase();
        tags = tags.filter(t => t.name.toLowerCase().includes(lower));
      }

      // Client-side pagination
      const offset = options?.offset ?? 0;
      const limit = options?.limit;
      if (limit !== undefined) {
        tags = tags.slice(offset, offset + limit);
      } else if (offset > 0) {
        tags = tags.slice(offset);
      }

      return tags;
    },

    // ── Links & Graph ─────────────────────────────
    async getBacklinks(noteId) {
      return safeBridgeCall(() => bridge.getBacklinks(noteId), 'getBacklinks');
    },

    async getOutgoingLinks(noteId) {
      return safeBridgeCall(() => bridge.getOutgoingLinks(noteId), 'getOutgoingLinks');
    },

    async getGraphData(options) {
      const graph = await safeBridgeCall(() => bridge.getGraphData(), 'getGraphData');

      // Client-side filtering by notebook
      if (options?.notebookId) {
        const nodeIds = new Set(
          graph.nodes.filter(n => n.notebookId === options.notebookId).map(n => n.id)
        );
        return {
          nodes: graph.nodes.filter(n => nodeIds.has(n.id)),
          edges: graph.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target)),
        };
      }

      return graph;
    },

    // ── Events ────────────────────────────────────
    onNotesChanged(cb) {
      notesChangedListeners.add(cb);
      return () => {
        notesChangedListeners.delete(cb);
      };
    },
    onNotebooksChanged(cb) {
      notebooksChangedListeners.add(cb);
      return () => {
        notebooksChangedListeners.delete(cb);
      };
    },
    onTagsChanged(cb) {
      tagsChangedListeners.add(cb);
      return () => {
        tagsChangedListeners.delete(cb);
      };
    },

    // ── Internal notify (called by host) ──────────
    _notifyNotesChanged(event) {
      for (const cb of notesChangedListeners) cb(event);
    },
    _notifyNotebooksChanged(event) {
      for (const cb of notebooksChangedListeners) cb(event);
    },
    _notifyTagsChanged(event) {
      for (const cb of tagsChangedListeners) cb(event);
    },
  };
}
```

**Step 2: Add `data: DataAPI` to PluginContext in types.ts**

In `packages/plugin-api/src/types.ts`, add an import and the `data` field:

```typescript
// At the top, add import:
import type { DataAPI } from './data/createDataAPI';

// In PluginContext interface (after `app: AppAPI;`), add:
/** Rich data query API for notes, notebooks, tags, links, and graph */
data: DataAPI;
```

**Step 3: Run typecheck**

Run: `cd packages/plugin-api && pnpm typecheck`
Expected: May fail because PluginRegistry doesn't provide `data` yet — that's OK, we'll wire it in Task 4.

**Step 4: Commit**

```bash
git add packages/plugin-api/src/data/createDataAPI.ts packages/plugin-api/src/types.ts
git commit -m "feat(plugin-api): add DataAPI interface, bridge, and createDataAPI factory"
```

---

### Task 3: Unit tests for createDataAPI

**Files:**

- Create: `packages/plugin-api/tests/createDataAPI.test.ts`

**Context:** Follow the pattern from `createAppAPI.test.ts`. Mock the bridge, test delegation, error wrapping, tag filtering, graph filtering, and events.

**Step 1: Write the test file**

```typescript
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
      const notes = [
        {
          id: '1',
          title: 'A',
          notebookId: 'nb',
          tags: [],
          wordCount: 10,
          createdAt: '',
          updatedAt: '',
          isPinned: false,
          status: 'active',
        },
      ];
      const api = createDataAPI(makeBridge({ getNotes: async () => ({ notes, total: 5 }) }));
      const result = await api.getNotes({ limit: 2, offset: 0 });
      expect(result.notes).toEqual(notes);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
    });

    it('hasMore is false when all notes returned', async () => {
      const api = createDataAPI(
        makeBridge({
          getNotes: async () => ({
            notes: [
              {
                id: '1',
                title: 'A',
                notebookId: 'nb',
                tags: [],
                wordCount: 0,
                createdAt: '',
                updatedAt: '',
                isPinned: false,
                status: 'active',
              },
            ],
            total: 1,
          }),
        })
      );
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
      const tree = [
        { id: 'nb-1', name: 'Root', parentId: null, noteCount: 5, childCount: 1, children: [] },
      ];
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
      const api = createDataAPI(
        makeBridge({
          getTagsWithColors: async () => [
            { name: 'js', color: '#ff0' },
            { name: 'go', color: null },
          ],
        })
      );
      const result = await api.getTags({ includeColors: true });
      expect(result).toEqual([
        { name: 'js', color: '#ff0' },
        { name: 'go', color: null },
      ]);
    });

    it('filters by case-insensitive substring', async () => {
      const api = createDataAPI(
        makeBridge({ getTags: async () => ['JavaScript', 'Java', 'Python'] })
      );
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
      const api = createDataAPI(
        makeBridge({
          getNotes: async () => {
            throw new Error('IPC timeout');
          },
        })
      );
      await expect(api.getNotes()).rejects.toThrow(DataAccessError);
      await expect(api.getNotes()).rejects.toThrow('[DataAPI.getNotes] IPC timeout');
    });

    it('wraps non-Error throws', async () => {
      const api = createDataAPI(
        makeBridge({
          getNote: async () => {
            throw 'string error';
          },
        })
      );
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
      api._notifyTagsChanged({
        kind: 'tag',
        action: 'renamed',
        id: 'new-name',
        previousName: 'old-name',
      });
      expect(cb).toHaveBeenCalledWith({
        kind: 'tag',
        action: 'renamed',
        id: 'new-name',
        previousName: 'old-name',
      });
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
```

**Step 2: Run tests**

Run: `cd packages/plugin-api && pnpm vitest run tests/createDataAPI.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add packages/plugin-api/tests/createDataAPI.test.ts
git commit -m "test(plugin-api): add comprehensive tests for createDataAPI"
```

---

### Task 4: Wire DataAPI into PluginRegistry.activate()

**Files:**

- Modify: `packages/plugin-api/src/lifecycle/PluginRegistry.ts:90-98` (add `dataAPI` param to `activate()`)
- Modify: `packages/plugin-api/src/lifecycle/PluginRegistry.ts:228-290` (add `data: trackedData` to context)

**Context:** Follow the exact same pattern as `appAPI` — it's passed into `activate()`, tracked for event cleanup, and injected into the `context` object. The `PluginRegistry.activate()` signature gets a new `dataAPI` parameter.

**Step 1: Update PluginRegistry**

Add `DataAPI` to the imports:

```typescript
import type { DataAPI } from '../data/createDataAPI';
```

Update `activate()` signature (add after `appAPI: AppAPI`):

```typescript
async activate(
  id: string,
  editorAPI: EditorAPI,
  appAPI: AppAPI,
  dataAPI: DataAPI,    // NEW
  registerCommandFn?: RegisterCommandFn,
  configBridge?: ConfigBridge,
  getView?: () => EditorView | null
): Promise<void> {
```

Wrap `dataAPI` events for auto-cleanup (same pattern as `trackedApp`):

```typescript
const trackedData: DataAPI = {
  ...dataAPI,
  onNotesChanged(callback) {
    const unsub = dataAPI.onNotesChanged(callback);
    const tracked = () => {
      unsub();
      entry.eventUnsubscribers = entry.eventUnsubscribers.filter(u => u !== tracked);
    };
    entry.eventUnsubscribers.push(tracked);
    return tracked;
  },
  onNotebooksChanged(callback) {
    const unsub = dataAPI.onNotebooksChanged(callback);
    const tracked = () => {
      unsub();
      entry.eventUnsubscribers = entry.eventUnsubscribers.filter(u => u !== tracked);
    };
    entry.eventUnsubscribers.push(tracked);
    return tracked;
  },
  onTagsChanged(callback) {
    const unsub = dataAPI.onTagsChanged(callback);
    const tracked = () => {
      unsub();
      entry.eventUnsubscribers = entry.eventUnsubscribers.filter(u => u !== tracked);
    };
    entry.eventUnsubscribers.push(tracked);
    return tracked;
  },
};
```

Add `data: trackedData` to the context object (after `app: trackedApp`):

```typescript
const context: PluginContext = {
  // ... existing fields ...
  app: trackedApp,
  data: trackedData, // NEW
};
```

**Step 2: Update PluginHost to pass dataAPI**

Modify `packages/plugin-api/src/lifecycle/PluginHost.tsx`:

Add `DataAPI` to the import and props:

```typescript
import type { PluginManifest, EditorAPI, AppAPI } from '../types';
import type { DataAPI } from '../data/createDataAPI';

interface PluginHostProps {
  plugins: PluginManifest[];
  editorAPI: EditorAPI;
  appAPI: AppAPI;
  dataAPI: DataAPI; // NEW
  registerCommand?: RegisterCommandFn;
  configBridge?: ConfigBridge;
  getView?: () => EditorView | null;
}
```

Destructure `dataAPI` and pass to `registry.activate()`:

```typescript
export function PluginHost({
  plugins,
  editorAPI,
  appAPI,
  dataAPI,  // NEW
  registerCommand,
  configBridge,
  getView,
}: PluginHostProps) {
  // ...
  await registry.activate(
    manifest.id,
    editorAPI,
    appAPI,
    dataAPI,  // NEW — between appAPI and registerCommand
    registerCommand,
    configBridge,
    getView
  );
```

**Step 3: Update registry tests**

Modify `packages/plugin-api/tests/registry.test.ts` — wherever `registry.activate()` is called, add a mock `dataAPI` parameter. Create a minimal mock:

```typescript
const mockDataAPI = {
  getNotes: async () => ({ notes: [], total: 0, hasMore: false }),
  getNote: async () => null,
  searchNotes: async () => ({ results: [], total: 0 }),
  countNotes: async () => 0,
  getNotebooks: async () => [],
  getNotebook: async () => null,
  getTags: async () => [],
  getBacklinks: async () => [],
  getOutgoingLinks: async () => [],
  getGraphData: async () => ({ nodes: [], edges: [] }),
  onNotesChanged: () => () => {},
  onNotebooksChanged: () => () => {},
  onTagsChanged: () => () => {},
} as any;
```

Insert `mockDataAPI` after `mockAppAPI` in every `registry.activate(id, mockEditorAPI, mockAppAPI, ...)` call.

**Step 4: Run tests**

Run: `cd packages/plugin-api && pnpm vitest run`
Expected: All tests PASS

**Step 5: Run typecheck**

Run: `cd packages/plugin-api && pnpm typecheck`
Expected: PASS (types.ts now references DataAPI, PluginRegistry provides it)

Note: `apps/desktop` typecheck will fail because `App.tsx` and `PluginHost` aren't updated yet — that's Task 5.

**Step 6: Commit**

```bash
git add packages/plugin-api/src/lifecycle/PluginRegistry.ts packages/plugin-api/src/lifecycle/PluginHost.tsx packages/plugin-api/tests/registry.test.ts
git commit -m "feat(plugin-api): wire DataAPI into PluginRegistry and PluginHost"
```

---

### Task 5: Barrel exports

**Files:**

- Modify: `packages/plugin-api/src/index.ts`

**Context:** Export all new types and the factory from the barrel so the host app can import them.

**Step 1: Add data exports to index.ts**

After the `// App` section, add:

```typescript
// Data
export type { DataAPI, DataAPIWithEvents, DataAPIBridge } from './data/createDataAPI';
export { createDataAPI } from './data/createDataAPI';
export type {
  NoteQueryOptions,
  NoteQueryResult,
  SearchOptions,
  SearchResult,
  NotebookQueryOptions,
  NotebookDetailInfo,
  NotebookTreeNode,
  NotebookResult,
  TagQueryOptions,
  TagInfo,
  GraphQueryOptions,
  GraphData,
  LinkInfo,
  OutgoingLinkInfo,
  DataChangeEvent,
} from './data/dataTypes';
export { DataAccessError } from './data/dataTypes';
```

**Step 2: Run typecheck**

Run: `cd packages/plugin-api && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/plugin-api/src/index.ts
git commit -m "feat(plugin-api): export DataAPI types and factory from barrel"
```

---

### Task 6: Wire DataAPIBridge in App.tsx

**Files:**

- Modify: `apps/desktop/src/renderer/App.tsx:7` (add imports)
- Modify: `apps/desktop/src/renderer/App.tsx:139-190` (add dataAPI useMemo)
- Modify: `apps/desktop/src/renderer/App.tsx:576-582` (pass dataAPI to PluginHost)

**Context:** This is the host-side bridge — same pattern as the existing `appAPI` useMemo block. We create a `DataAPIBridge` that maps to `window.dripnex.*` IPC calls, then pass `createDataAPI(bridge)` to `PluginHost`.

**Step 1: Add imports**

```typescript
import {
  PluginHost,
  createEditorAPI,
  createAppAPI,
  createDataAPI, // NEW
  editorPluginStore,
  useCssVariables,
} from '@dripnex/plugin-api';
import type { DataAPIWithEvents } from '@dripnex/plugin-api';
```

**Step 2: Add dataAPI useMemo (after the appAPI block)**

```typescript
const dataAPI = useMemo<DataAPIWithEvents>(
  () =>
    createDataAPI({
      async getNotes(options) {
        const notes = await window.dripnex.notes.list(
          options
            ? {
                limit: options.limit,
                offset: options.offset,
                tag: options.tag,
                sortBy: options.sortBy === 'wordCount' ? 'updatedAt' : options.sortBy,
                sortOrder: options.sortOrder,
              }
            : undefined
        );
        // Filter by notebookId, status, isPinned client-side (IPC doesn't support these directly)
        let filtered = notes;
        if (options?.notebookId)
          filtered = filtered.filter(n => n.notebookId === options.notebookId);
        if (options?.status) filtered = filtered.filter(n => n.status === options.status);
        if (options?.isPinned !== undefined)
          filtered = filtered.filter(n => n.isPinned === options.isPinned);
        return {
          notes: filtered.map(n => ({
            id: n.id,
            title: n.title,
            notebookId: n.notebookId,
            tags: [...n.tags],
            wordCount: n.wordCount,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
            isPinned: n.isPinned,
            status: n.status,
          })),
          total: filtered.length,
        };
      },
      async getNote(id) {
        const result = await window.dripnex.notes.get(id);
        if (!result.ok) return null;
        return { id: result.data.id, title: result.data.title, content: result.data.content };
      },
      async searchNotes(query, options) {
        const notes = await window.dripnex.notes.search(query, options?.limit ?? 20);
        return {
          results: notes.map(n => ({ id: n.id, title: n.title })),
          total: notes.length,
        };
      },
      async countNotes() {
        const counts = await window.dripnex.notes.count();
        return counts.total;
      },
      async getNotebooks() {
        const notebooks = await window.dripnex.notebooks.list();
        return notebooks.map(nb => ({ id: nb.id, name: nb.name, parentId: nb.parentId }));
      },
      async getNotebookTree() {
        const tree = await window.dripnex.notebooks.tree();
        const mapNode = (node: any): any => ({
          id: node.notebook.id,
          name: node.notebook.name,
          parentId: node.notebook.parentId,
          noteCount: 0,
          childCount: node.children.length,
          children: node.children.map(mapNode),
        });
        return tree.map(mapNode);
      },
      async getNotebook(id) {
        const nb = await window.dripnex.notebooks.getWithMetadata(id);
        if (!nb) return null;
        return {
          id: nb.id,
          name: nb.name,
          parentId: nb.parentId,
          noteCount: nb.noteCount,
          childCount: nb.childCount,
        };
      },
      async getTags() {
        return window.dripnex.notes.tags();
      },
      async getTagsWithColors() {
        return window.dripnex.notes.tagsWithColors();
      },
      async getBacklinks(noteId) {
        const links = await window.dripnex.links.getBacklinks(noteId);
        return links.map(l => ({ noteId: l.noteId, noteTitle: l.noteTitle }));
      },
      async getOutgoingLinks(noteId) {
        const links = await window.dripnex.links.getOutgoing(noteId);
        return links.map(l => ({
          targetId: l.targetNoteId,
          targetTitle: l.targetTitle ?? l.targetRef,
          resolved: l.targetNoteId !== null,
        }));
      },
      async getGraphData() {
        return window.dripnex.links.getGraph();
      },
    }),
  []
);
```

**Step 3: Pass to PluginHost**

```tsx
<PluginHost
  plugins={allPlugins}
  editorAPI={editorAPI}
  appAPI={appAPI}
  dataAPI={dataAPI} // NEW
  registerCommand={registerPluginCommand}
  configBridge={configBridge}
  getView={getEditorView}
/>
```

**Step 4: Fire data events from existing mutation callbacks**

In the `handleCreateNote`, `handleDeleteNote`, etc. callbacks, add data event notifications alongside the existing appAPI ones:

```typescript
// In handleCreateNote (after appAPI._notifyNoteCreated):
dataAPI._notifyNotesChanged({ kind: 'note', action: 'created', id: newNote.id });

// In handleDeleteNote (after appAPI._notifyNoteDeleted):
dataAPI._notifyNotesChanged({ kind: 'note', action: 'deleted', id });
```

**Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: All 18 packages PASS

**Step 6: Run tests**

Run: `pnpm test`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add apps/desktop/src/renderer/App.tsx
git commit -m "feat: wire DataAPI bridge to IPC in App.tsx and fire data events"
```

---

### Task 7: Final typecheck + full test run

**Files:** None (verification only)

**Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: 18/18 packages PASS

**Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests PASS across all packages

**Step 3: Verify no regressions**

Check that:

- Existing `createAppAPI.test.ts` still passes (AppAPI unchanged)
- Existing `registry.test.ts` passes (updated to pass mockDataAPI)
- New `dataTypes.test.ts` passes (DataAccessError)
- New `createDataAPI.test.ts` passes (all query + event tests)
