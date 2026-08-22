import type { LocalHttpChangeRecord } from './http.js';

export class LocalHttpRequiredError extends Error {
  constructor(tool: string) {
    super(
      `${tool} needs Dripnex Local HTTP. Set DRIPNEX_LOCAL_SERVER_URL and DRIPNEX_LOCAL_TOKEN.`
    );
    this.name = 'LocalHttpRequiredError';
  }
}

export interface NoteListRow {
  id: string;
  title: string;
  word_count?: number;
  created_at?: string;
  updated_at: string;
  is_pinned?: number | boolean;
  is_deleted?: number | boolean;
  status?: string;
  notebook_id?: string;
  notebook_name?: string | null;
  excerpt?: string;
}

export interface NoteReadRow {
  id: string;
  title: string;
  content: string;
  notebook_id?: string;
}

export interface NoteSearchRow {
  id: string;
  title: string;
  snippet: string;
}

export interface NotebookRow {
  id: string;
  name: string;
  parent_id?: string | null;
  icon?: string | null;
  note_count?: number;
}

export interface TagRow {
  name: string;
  color?: string | null;
  note_count?: number;
}

export interface TemplateRow {
  id: string;
  title: string;
  content: string;
}

export interface McpDataStore {
  listNotes(input: {
    notebook?: string;
    limit: number;
    includeTrash: boolean;
    status?: string;
  }): Promise<NoteListRow[]>;
  readNote(input: { id?: string; title?: string }): Promise<NoteReadRow | null>;
  searchNotes(query: string, limit: number): Promise<NoteSearchRow[]>;
  listNotebooks(): Promise<NotebookRow[]>;
  listTags(): Promise<TagRow[]>;
  listTemplates(): Promise<TemplateRow[]>;
  findTemplate(name: string): Promise<TemplateRow | null>;
  findNotebookIdByName(name: string): Promise<string | null>;
  createNote(input: {
    content: string;
    notebookId?: string;
  }): Promise<{ id: string; title: string }>;
  updateNote(id: string, content: string): Promise<{ title: string } | null>;
  trashNote(id: string, permanent?: boolean): Promise<boolean>;
  status(): Promise<{ status: string; version: string; noteCount: number }>;
  createNotebook(input: { name: string; parentId?: string }): Promise<{ id: string }>;
  updateNotebook(id: string, patch: { name?: string; icon?: string | null }): Promise<boolean>;
  deleteNotebook(id: string): Promise<boolean>;
  createTag(input: { name: string; color?: string | null }): Promise<{ name: string }>;
  updateTag(name: string, patch: { color?: string | null; newName?: string }): Promise<boolean>;
  getChanges(since: number): Promise<{ results: LocalHttpChangeRecord[]; last_seq: number }>;
}
