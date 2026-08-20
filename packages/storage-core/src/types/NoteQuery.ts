import type { NoteStatus, Tag } from '@dripnex/core';

export interface NoteCountSummary {
  total: number;
  active: number;
  archived: number;
  pinned: number;
  deleted: number;
  byStatus: Record<NoteStatus, number>;
  byNotebook: Record<string, number>;
}

export interface NoteCountScoped {
  total: number;
  byStatus: Record<NoteStatus, number>;
  byTag: Record<string, number>;
}

export interface BacklinkInfo {
  noteId: string;
  noteTitle: string;
  targetRef: string;
}

export interface OutgoingLinkInfo {
  targetRef: string;
  targetNoteId: string | null;
  targetTitle: string | null;
}

export interface GraphNodeInfo {
  id: string;
  title: string;
  notebookId: string;
  status: string;
  tags: string[];
}

export interface GraphData {
  nodes: GraphNodeInfo[];
  edges: Array<{ source: string; target: string }>;
}

export type { Tag };
