import type { NoteStatus } from '@dripnex/core';

const PREFIX = 'dripnex.note.v1\n';
const STATUSES: readonly NoteStatus[] = ['active', 'on_hold', 'completed', 'dropped'];

export interface SyncedNotePayload {
  content: string;
  notebookId: string;
  isPinned: boolean;
  isDeleted: boolean;
  status: NoteStatus;
  tags: string[];
}

export function serializeSyncedNote(payload: SyncedNotePayload): string {
  return `${PREFIX}${JSON.stringify({
    content: payload.content,
    notebookId: payload.notebookId,
    isPinned: payload.isPinned,
    isDeleted: payload.isDeleted,
    status: payload.status,
    tags: payload.tags,
  })}`;
}

export function parseSyncedNote(decrypted: string): SyncedNotePayload {
  if (!decrypted.startsWith(PREFIX)) {
    return {
      content: decrypted,
      notebookId: 'inbox',
      isPinned: false,
      isDeleted: false,
      status: 'active',
      tags: [],
    };
  }

  try {
    const parsed = JSON.parse(decrypted.slice(PREFIX.length)) as Record<string, unknown>;
    const status = STATUSES.includes(parsed.status as NoteStatus)
      ? (parsed.status as NoteStatus)
      : 'active';
    return {
      content: typeof parsed.content === 'string' ? parsed.content : decrypted,
      notebookId:
        typeof parsed.notebookId === 'string' && parsed.notebookId ? parsed.notebookId : 'inbox',
      isPinned: parsed.isPinned === true,
      isDeleted: parsed.isDeleted === true,
      status,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((tag): tag is string => typeof tag === 'string')
        : [],
    };
  } catch {
    return {
      content: decrypted,
      notebookId: 'inbox',
      isPinned: false,
      isDeleted: false,
      status: 'active',
      tags: [],
    };
  }
}
