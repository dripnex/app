import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { NoteSnapshot } from '../../preload/index';
import {
  NOW_BOARD_CONTENT,
  NOW_BOARD_ID,
  NOW_BOARD_NOTEBOOK_ID,
  NOW_BOARD_TAGS,
} from '../data/nowBoard';
import { noteKeys } from './useNotes';

export async function ensureNowBoard(): Promise<{ note: NoteSnapshot; created: boolean } | null> {
  if (!window.dripnex?.notes) return null;
  const existing = await window.dripnex.notes.get(NOW_BOARD_ID);
  if (existing.ok) {
    return { note: existing.data, created: false };
  }

  const created = await window.dripnex.notes.create({
    id: NOW_BOARD_ID,
    content: NOW_BOARD_CONTENT,
    notebookId: NOW_BOARD_NOTEBOOK_ID,
  });
  if (!created.ok) {
    const raced = await window.dripnex.notes.get(NOW_BOARD_ID);
    return raced.ok ? { note: raced.data, created: false } : null;
  }

  await window.dripnex.notes.pin(created.data.id);
  await window.dripnex.notes.setManualTags(created.data.id, [...NOW_BOARD_TAGS]);
  return { note: created.data, created: true };
}

/** Creates the living board note once if it is missing. */
export function useEnsureNowBoard(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    void ensureNowBoard().then(result => {
      if (cancelled || !result?.created) return;
      void queryClient.invalidateQueries({ queryKey: noteKeys.all });
    });
    return () => {
      cancelled = true;
    };
  }, [queryClient]);
}
