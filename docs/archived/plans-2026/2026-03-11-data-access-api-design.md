# Data Access API — Design Document

## Goal

Provide plugins with a dedicated, rich `DataAPI` namespace (`context.data`) for querying notes, notebooks, tags, links, and graph data — with filters, sorting, pagination, events, and consistent error handling.

## Problem

The existing `AppAPI` offers flat, parameterless getters (`listNotes()`, `listTags()`, `listNotebooks()`) with no filtering, sorting, pagination, or structural queries. Plugins that need analytics, visualizations, or filtered views must reconstruct everything client-side. This is the difference between "some getters" and a real data access layer.

## Architecture

### Layering

```
Plugin code
  → context.data.getNotes({ tag: 'x', sortBy: 'updatedAt' })
    → createDataAPI() — options handling, error wrapping, event dispatch
      → DataAPIBridge — thin 1:1 mapping to IPC
        → window.dripnex.notes.list({ tag: 'x', sortBy: 'updatedAt' })
          → ipcRenderer.invoke('notes:list', ...)
            → SQLiteNoteRepository.list(...)
```

### Key Decisions

- **Dedicated namespace**: `context.data` separate from `context.app`
- **AppAPI unchanged**: Existing methods stay as-is for backward compatibility; internally they can share the same bridge
- **Bridge is thin**: Maps 1:1 to existing IPC calls. No business logic in the bridge.
- **createDataAPI() owns logic**: Options merging, client-side filtering (graph), error wrapping
- **All read-only**: No mutations through DataAPI. Plugins observe, never modify.

## DataAPI Interface

```typescript
export interface DataAPI {
  // ── Notes ─────────────────────────────────────────
  getNotes(options?: NoteQueryOptions): Promise<NoteQueryResult>;
  getNote(id: string): Promise<NoteInfo | null>;
  searchNotes(query: string, options?: SearchOptions): Promise<SearchResult>;
  countNotes(options?: { notebookId?: string; tag?: string }): Promise<number>;

  // ── Notebooks ─────────────────────────────────────
  getNotebooks(options?: NotebookQueryOptions): Promise<NotebookResult>;
  getNotebook(id: string): Promise<NotebookDetailInfo | null>;

  // ── Tags ──────────────────────────────────────────
  getTags(options?: TagQueryOptions): Promise<TagInfo[]>;

  // ── Links & Graph ─────────────────────────────────
  getBacklinks(noteId: string): Promise<LinkInfo[]>;
  getOutgoingLinks(noteId: string): Promise<OutgoingLinkInfo[]>;
  getGraphData(options?: GraphQueryOptions): Promise<GraphData>;

  // ── Events ────────────────────────────────────────
  onNotesChanged(callback: (event: DataChangeEvent<'note'>) => void): () => void;
  onNotebooksChanged(callback: (event: DataChangeEvent<'notebook'>) => void): () => void;
  onTagsChanged(callback: (event: DataChangeEvent<'tag'>) => void): () => void;
}
```

## Query Options

```typescript
export interface NoteQueryOptions {
  notebookId?: string;
  tag?: string;
  status?: string;
  isPinned?: boolean;
  sortBy?: 'title' | 'createdAt' | 'updatedAt' | 'wordCount';
  sortOrder?: 'asc' | 'desc';
  limit?: number; // default: 50
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
  tree?: boolean; // default: false (flat list)
  includeCounts?: boolean; // include noteCount/childCount
}

export interface TagQueryOptions {
  includeColors?: boolean;
  includeCount?: boolean;
  filter?: string; // case-insensitive substring match on tag name
  limit?: number;
  offset?: number;
}

export interface GraphQueryOptions {
  notebookId?: string; // scope to notebook (client-side initially)
  depth?: number; // limit traversal depth
}
```

## Result Types

```typescript
export interface NotebookDetailInfo extends NotebookInfo {
  noteCount: number;
  childCount: number;
}

export interface NotebookTreeNode extends NotebookDetailInfo {
  children: NotebookTreeNode[];
}

export type NotebookResult = NotebookInfo[] | NotebookTreeNode[];

export interface TagInfo {
  name: string;
  color?: string | null;
  count?: number;
}

export interface LinkInfo {
  noteId: string;
  noteTitle: string;
}

export interface OutgoingLinkInfo {
  targetId: string | null; // null = unresolved wikilink
  targetTitle: string;
  resolved: boolean;
}

export interface GraphData {
  nodes: Array<{ id: string; title: string; notebookId: string }>;
  edges: Array<{ source: string; target: string }>;
}
```

## Events

```typescript
export interface DataChangeEvent<T extends 'note' | 'notebook' | 'tag'> {
  kind: T;
  action: 'created' | 'updated' | 'deleted' | 'renamed';
  id: string;
  /** For tag renames: the previous tag name */
  previousName?: string;
}
```

Events fire after mutations complete. The host calls internal `_notify*` methods (same pattern as `AppAPI`). Plugins subscribe via `context.data.on*Changed()` and receive typed change events.

## Error Handling

```typescript
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

Every bridge call is wrapped in `safeBridgeCall()` that catches IPC/SQLite errors and rethrows as `DataAccessError` with the method name. Plugins get consistent, typed errors.

## Bridge

```typescript
export interface DataAPIBridge {
  getNotes(options?: NoteQueryOptions): Promise<{ notes: NoteSummaryInfo[]; total: number }>;
  getNote(id: string): Promise<NoteInfo | null>;
  searchNotes(query: string, options?: SearchOptions): Promise<SearchResult>;
  countNotes(options?: { notebookId?: string; tag?: string }): Promise<number>;
  getNotebooks(): Promise<NotebookInfo[]>;
  getNotebookTree(): Promise<NotebookTreeNode[]>;
  getNotebook(id: string): Promise<NotebookDetailInfo | null>;
  getTags(): Promise<string[]>;
  getTagsWithColors(): Promise<Array<{ name: string; color: string | null }>>;
  getBacklinks(noteId: string): Promise<LinkInfo[]>;
  getOutgoingLinks(noteId: string): Promise<OutgoingLinkInfo[]>;
  getGraphData(): Promise<GraphData>;
}
```

## Integration in PluginContext

```typescript
export interface PluginContext {
  // ... existing fields unchanged
  app: AppAPI; // backward compatible, no changes
  data: DataAPI; // NEW
}
```

## Performance Notes

- Tag filtering (`filter` option) is case-insensitive substring. Applied client-side initially; can push to SQL later.
- Graph filtering by notebook is client-side (full graph fetched, then filtered in `createDataAPI()`). If graphs grow large, add IPC-level pre-filter.
- Note queries with `limit`/`offset` are pushed to SQLite via existing `notes:list` IPC which already supports these.

## Testing Strategy

- Unit tests for `createDataAPI()` with mock bridge (query option mapping, error wrapping, event dispatch)
- Unit tests for `DataAccessError` construction
- Integration test: bridge wired to IPC in `PluginRegistry.activate()`
- Existing `createAppAPI` tests stay unchanged
