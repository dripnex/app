import { ipcRenderer } from 'electron';
import type {
  Result,
  NoteSnapshot,
  NoteStatus,
  ListOptions,
  NoteCounts,
  NoteScopedCounts,
  TagWithColor,
  ActivityStats,
} from './types';

export interface NotesAPI {
  create: (input: {
    content: string;
    id?: string;
    title?: string;
    notebookId?: string;
  }) => Promise<Result<NoteSnapshot>>;
  get: (id: string) => Promise<Result<NoteSnapshot>>;
  update: (input: { id: string; content: string }) => Promise<Result<NoteSnapshot>>;
  updateTitle: (input: { id: string; title: string }) => Promise<Result<NoteSnapshot>>;
  delete: (id: string) => Promise<Result<void>>;
  archive: (id: string) => Promise<Result<NoteSnapshot>>;
  restore: (id: string) => Promise<Result<NoteSnapshot>>;
  duplicate: (id: string) => Promise<Result<NoteSnapshot>>;
  move: (noteId: string, notebookId: string) => Promise<Result<NoteSnapshot>>;
  pin: (id: string) => Promise<Result<NoteSnapshot>>;
  unpin: (id: string) => Promise<Result<NoteSnapshot>>;
  softDelete: (id: string) => Promise<Result<NoteSnapshot>>;
  restoreDeleted: (id: string) => Promise<Result<NoteSnapshot>>;
  setStatus: (id: string, status: NoteStatus) => Promise<Result<NoteSnapshot>>;
  list: (options?: ListOptions) => Promise<NoteSnapshot[]>;
  search: (query: string, limitOrOptions?: number | ListOptions) => Promise<NoteSnapshot[]>;
  tags: () => Promise<string[]>;
  tagsWithColors: () => Promise<TagWithColor[]>;
  queryTags: (options?: {
    filter?: string;
    limit?: number;
    offset?: number;
    includeCount?: boolean;
  }) => Promise<Array<{ name: string; color: string | null; count?: number }>>;
  setTagColor: (tagName: string, color: string | null) => Promise<{ ok: boolean }>;
  deleteTag: (tagName: string) => Promise<{ ok: boolean }>;
  renameTag: (oldName: string, newName: string) => Promise<{ ok: boolean; error?: string }>;
  setManualTags: (noteId: string, tags: string[]) => Promise<{ ok: boolean }>;
  getManualTags: (noteId: string) => Promise<string[]>;
  count: () => Promise<NoteCounts>;
  countScoped: (options?: ListOptions) => Promise<NoteScopedCounts>;
  activityStats: () => Promise<ActivityStats>;
}

export function createNotesApi(): NotesAPI {
  return {
    create: input => ipcRenderer.invoke('notes:create', input),
    get: id => ipcRenderer.invoke('notes:get', id),
    update: input => ipcRenderer.invoke('notes:update', input),
    updateTitle: input => ipcRenderer.invoke('notes:updateTitle', input),
    delete: id => ipcRenderer.invoke('notes:delete', id),
    archive: id => ipcRenderer.invoke('notes:archive', id),
    restore: id => ipcRenderer.invoke('notes:restore', id),
    duplicate: id => ipcRenderer.invoke('notes:duplicate', id),
    move: (noteId, notebookId) => ipcRenderer.invoke('notes:move', noteId, notebookId),
    pin: id => ipcRenderer.invoke('notes:pin', id),
    unpin: id => ipcRenderer.invoke('notes:unpin', id),
    softDelete: id => ipcRenderer.invoke('notes:softDelete', id),
    restoreDeleted: id => ipcRenderer.invoke('notes:restoreDeleted', id),
    setStatus: (id, status) => ipcRenderer.invoke('notes:setStatus', id, status),
    list: options => ipcRenderer.invoke('notes:list', options),
    search: (query, limitOrOptions) => ipcRenderer.invoke('notes:search', query, limitOrOptions),
    tags: () => ipcRenderer.invoke('notes:tags'),
    tagsWithColors: () => ipcRenderer.invoke('tags:listWithColors'),
    queryTags: options => ipcRenderer.invoke('tags:query', options),
    setTagColor: (tagName, color) => ipcRenderer.invoke('tags:setColor', tagName, color),
    deleteTag: tagName => ipcRenderer.invoke('tags:delete', tagName),
    renameTag: (oldName, newName) => ipcRenderer.invoke('tags:rename', oldName, newName),
    setManualTags: (noteId, tags) => ipcRenderer.invoke('notes:setManualTags', noteId, tags),
    getManualTags: noteId => ipcRenderer.invoke('notes:getManualTags', noteId),
    count: () => ipcRenderer.invoke('notes:count'),
    countScoped: options => ipcRenderer.invoke('notes:countScoped', options),
    activityStats: () => ipcRenderer.invoke('notes:activityStats'),
  };
}
