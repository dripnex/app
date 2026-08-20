import { extractTitle } from '@dripnex/core';

export function conflictNoteTitle(content: string): string {
  return extractTitle(content);
}

export function remoteCopyTitle(title: string): string {
  const base = title.trim() || 'Untitled';
  return /\(remote\)\s*$/i.test(base) ? base : `${base} (remote)`;
}

export function conflictQueueLabel(index: number, total: number): string {
  if (total <= 1) return '1 conflict';
  return `Conflict ${index + 1} of ${total}`;
}

export function mergeConflicts<T extends { noteId: string }>(existing: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return existing;
  const byId = new Map(existing.map(conflict => [conflict.noteId, conflict]));
  for (const conflict of incoming) {
    byId.set(conflict.noteId, conflict);
  }
  return [...byId.values()];
}

export function hasNewConflict<T extends { noteId: string }>(
  existing: T[],
  incoming: T[]
): boolean {
  return incoming.some(conflict => !existing.some(current => current.noteId === conflict.noteId));
}
