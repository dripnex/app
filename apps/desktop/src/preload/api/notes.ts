import { ipcRenderer } from 'electron';
import type {
  Result,
  NoteSnapshot,
  NoteStatus,
  BoardStage,
  NotePriority,
  ListOptions,
  NoteCounts,
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
  setBoardStage: (id: string, boardStage: BoardStage | null) => Promise<Result<NoteSnapshot>>;
  setPriority: (id: string, priority: NotePriority) => Promise<Result<NoteSnapshot>>;
  reorderColumn: (stage: BoardStage, orderedIds: string[]) => Promise<{ ok: boolean }>;
  list: (options?: ListOptions) => Promise<NoteSnapshot[]>;
  search: (query: string, limit?: number) => Promise<NoteSnapshot[]>;
  tags: () => Promise<string[]>;
  tagsWithColors: () => Promise<TagWithColor[]>;
  setTagColor: (tagName: string, color: string | null) => Promise<{ ok: boolean }>;
  deleteTag: (tagName: string) => Promise<{ ok: boolean }>;
  renameTag: (oldName: string, newName: string) => Promise<{ ok: boolean; error?: string }>;
  setManualTags: (noteId: string, tags: string[]) => Promise<{ ok: boolean }>;
  getManualTags: (noteId: string) => Promise<string[]>;
  count: () => Promise<NoteCounts>;
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
    setBoardStage: (id, boardStage) => ipcRenderer.invoke('notes:setBoardStage', id, boardStage),
    setPriority: (id, priority) => ipcRenderer.invoke('notes:setPriority', id, priority),
    reorderColumn: (stage, orderedIds) =>
      ipcRenderer.invoke('notes:reorderColumn', stage, orderedIds),
    list: options => ipcRenderer.invoke('notes:list', options),
    search: (query, limit) => ipcRenderer.invoke('notes:search', query, limit),
    tags: () => ipcRenderer.invoke('notes:tags'),
    tagsWithColors: () => ipcRenderer.invoke('tags:listWithColors'),
    setTagColor: (tagName, color) => ipcRenderer.invoke('tags:setColor', tagName, color),
    deleteTag: tagName => ipcRenderer.invoke('tags:delete', tagName),
    renameTag: (oldName, newName) => ipcRenderer.invoke('tags:rename', oldName, newName),
    setManualTags: (noteId, tags) => ipcRenderer.invoke('notes:setManualTags', noteId, tags),
    getManualTags: noteId => ipcRenderer.invoke('notes:getManualTags', noteId),
    count: () => ipcRenderer.invoke('notes:count'),
    activityStats: () => ipcRenderer.invoke('notes:activityStats'),
  };
}
