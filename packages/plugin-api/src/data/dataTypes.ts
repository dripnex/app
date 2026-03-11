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
