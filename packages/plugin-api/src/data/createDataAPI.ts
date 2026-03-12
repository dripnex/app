// packages/plugin-api/src/data/createDataAPI.ts

import type {
  NoteInfo,
  NoteSummaryInfo,
  NotebookInfo,
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
  LinkInfo,
  OutgoingLinkInfo,
  GraphData,
  DataChangeEvent,
} from './dataTypes';
import { DataAccessError } from './dataTypes';

// ── DataAPI (what plugins see) ──────────────────────

export interface DataAPI {
  getNotes(options?: NoteQueryOptions): Promise<NoteQueryResult>;
  getNote(id: string): Promise<NoteInfo | null>;
  searchNotes(query: string, options?: SearchOptions): Promise<SearchResult>;
  countNotes(options?: NoteQueryOptions): Promise<number>;
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

// ── DataAPIWithEvents (host-facing, adds _notify*) ──

export interface DataAPIWithEvents extends DataAPI {
  _notifyNotesChanged(event: DataChangeEvent<'note'>): void;
  _notifyNotebooksChanged(event: DataChangeEvent<'notebook'>): void;
  _notifyTagsChanged(event: DataChangeEvent<'tag'>): void;
}

// ── DataAPIBridge (thin IPC wrapper) ────────────────

export interface DataAPIBridge {
  getNotes(options?: NoteQueryOptions): Promise<{ notes: NoteSummaryInfo[]; total: number }>;
  getNote(id: string): Promise<NoteInfo | null>;
  searchNotes(query: string, options?: SearchOptions): Promise<SearchResult>;
  countNotes(options?: NoteQueryOptions): Promise<number>;
  getNotebooks(): Promise<NotebookInfo[]>;
  getNotebookTree(): Promise<NotebookTreeNode[]>;
  getNotebook(id: string): Promise<NotebookDetailInfo | null>;
  getTags(): Promise<string[]>;
  getTagsWithColors(): Promise<Array<{ name: string; color: string | null }>>;
  getBacklinks(noteId: string): Promise<LinkInfo[]>;
  getOutgoingLinks(noteId: string): Promise<OutgoingLinkInfo[]>;
  getGraphData(): Promise<GraphData>;
}

// ── Helpers ─────────────────────────────────────────

async function safeBridgeCall<T>(method: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof DataAccessError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new DataAccessError(method, message);
  }
}

// ── Factory ─────────────────────────────────────────

export function createDataAPI(bridge: DataAPIBridge): DataAPIWithEvents {
  const notesChangedListeners = new Set<(event: DataChangeEvent<'note'>) => void>();
  const notebooksChangedListeners = new Set<(event: DataChangeEvent<'notebook'>) => void>();
  const tagsChangedListeners = new Set<(event: DataChangeEvent<'tag'>) => void>();

  return {
    // ── Notes ──────────────────────────────────────

    async getNotes(options?: NoteQueryOptions): Promise<NoteQueryResult> {
      return safeBridgeCall('getNotes', async () => {
        const offset = options?.offset ?? 0;
        const { notes, total } = await bridge.getNotes(options);
        const hasMore = offset + notes.length < total;
        return { notes, total, hasMore };
      });
    },

    async getNote(id: string): Promise<NoteInfo | null> {
      return safeBridgeCall('getNote', () => bridge.getNote(id));
    },

    async searchNotes(query: string, options?: SearchOptions): Promise<SearchResult> {
      return safeBridgeCall('searchNotes', () => bridge.searchNotes(query, options));
    },

    async countNotes(options?: NoteQueryOptions): Promise<number> {
      return safeBridgeCall('countNotes', () => bridge.countNotes(options));
    },

    // ── Notebooks ──────────────────────────────────

    async getNotebooks(options?: NotebookQueryOptions): Promise<NotebookResult> {
      return safeBridgeCall('getNotebooks', async () => {
        if (options?.tree) {
          return bridge.getNotebookTree();
        }
        return bridge.getNotebooks();
      });
    },

    async getNotebook(id: string): Promise<NotebookDetailInfo | null> {
      return safeBridgeCall('getNotebook', () => bridge.getNotebook(id));
    },

    // ── Tags ───────────────────────────────────────

    async getTags(options?: TagQueryOptions): Promise<TagInfo[]> {
      return safeBridgeCall('getTags', async () => {
        let tags: TagInfo[];

        if (options?.includeColors) {
          const raw = await bridge.getTagsWithColors();
          tags = raw.map(t => ({ name: t.name, color: t.color }));
        } else {
          const raw = await bridge.getTags();
          tags = raw.map(name => ({ name }));
        }

        // Client-side case-insensitive substring filter
        if (options?.filter) {
          const filterLower = options.filter.toLowerCase();
          tags = tags.filter(t => t.name.toLowerCase().includes(filterLower));
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
      });
    },

    // ── Links & Graph ──────────────────────────────

    async getBacklinks(noteId: string): Promise<LinkInfo[]> {
      return safeBridgeCall('getBacklinks', () => bridge.getBacklinks(noteId));
    },

    async getOutgoingLinks(noteId: string): Promise<OutgoingLinkInfo[]> {
      return safeBridgeCall('getOutgoingLinks', () => bridge.getOutgoingLinks(noteId));
    },

    async getGraphData(options?: GraphQueryOptions): Promise<GraphData> {
      return safeBridgeCall('getGraphData', async () => {
        const graph = await bridge.getGraphData();

        if (options?.notebookId) {
          const filteredNodes = graph.nodes.filter(n => n.notebookId === options.notebookId);
          const nodeIds = new Set(filteredNodes.map(n => n.id));
          const filteredEdges = graph.edges.filter(
            e => nodeIds.has(e.source) && nodeIds.has(e.target)
          );
          return { nodes: filteredNodes, edges: filteredEdges };
        }

        return graph;
      });
    },

    // ── Events ─────────────────────────────────────

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

    // ── Internal notify (host calls these) ─────────

    _notifyNotesChanged(event) {
      for (const cb of [...notesChangedListeners]) cb(event);
    },

    _notifyNotebooksChanged(event) {
      for (const cb of [...notebooksChangedListeners]) cb(event);
    },

    _notifyTagsChanged(event) {
      for (const cb of [...tagsChangedListeners]) cb(event);
    },
  };
}
