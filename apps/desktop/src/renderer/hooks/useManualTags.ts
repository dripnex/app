import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { NoteSnapshot } from '../../preload/index';
import { noteKeys } from './useNotes';

interface UseManualTagsOptions {
  noteId: string | null;
  /** Tags from the note snapshot (inline #tags parsed from content) */
  inlineTags?: string[];
  /** Called when note is updated (for syncing selectedNote state) */
  onNoteUpdate?: (note: NoteSnapshot) => void;
}

interface UseManualTagsResult {
  /** Manual tags (user-added, not from content) */
  manualTags: string[];
  /** Combined tags (inline + manual, deduplicated and sorted) */
  displayTags: string[];
  /** Add a manual tag */
  addTag: (tag: string) => Promise<void>;
  /** Remove a manual tag */
  removeTag: (tag: string) => Promise<void>;
}

/**
 * Hook for managing manual tags on a note.
 *
 * Manual tags are user-added tags that are stored separately from
 * the inline #tags parsed from markdown content.
 */
export function useManualTags({
  noteId,
  inlineTags = [],
  onNoteUpdate,
}: UseManualTagsOptions): UseManualTagsResult {
  const queryClient = useQueryClient();
  const [manualTags, setManualTags] = useState<string[]>([]);

  // Fetch manual tags when note changes
  useEffect(() => {
    if (!noteId) {
      setManualTags([]);
      return;
    }

    // Capture noteId for async closure (TS narrowing doesn't persist in async)
    const currentNoteId = noteId;
    let cancelled = false;

    async function loadManualTags() {
      try {
        const tags = await window.dripnex.notes.getManualTags(currentNoteId);
        if (!cancelled) {
          setManualTags(tags);
        }
      } catch (error) {
        console.error('Failed to load manual tags:', error);
        if (!cancelled) {
          setManualTags([]);
        }
      }
    }

    void loadManualTags();

    return () => {
      cancelled = true;
    };
  }, [noteId]);

  // Add a manual tag with optimistic update
  const addTag = useCallback(
    async (tag: string) => {
      if (!noteId) return;

      const normalized = tag.trim().toLowerCase().replace(/^#/, '');
      if (!normalized || manualTags.includes(normalized)) return;

      const previousTags = manualTags;
      const updatedTags = [...manualTags, normalized];

      // Optimistic update
      setManualTags(updatedTags);

      try {
        await window.dripnex.notes.setManualTags(noteId, updatedTags);
        // Invalidate queries so sidebar and note list update
        void queryClient.invalidateQueries({ queryKey: noteKeys.tags() });
        void queryClient.invalidateQueries({ queryKey: noteKeys.lists() });

        // Refetch note to sync selectedNote state with updated tags
        if (onNoteUpdate) {
          const result = await window.dripnex.notes.get(noteId);
          if (result.ok) {
            onNoteUpdate(result.data);
          }
        }
      } catch (error) {
        console.error('Failed to save manual tags:', error);
        // Revert on error
        setManualTags(previousTags);
      }
    },
    [noteId, manualTags, queryClient, onNoteUpdate]
  );

  // Remove a manual tag with optimistic update
  const removeTag = useCallback(
    async (tag: string) => {
      if (!noteId) return;

      const previousTags = manualTags;
      const updatedTags = manualTags.filter(t => t !== tag);

      // Optimistic update
      setManualTags(updatedTags);

      try {
        await window.dripnex.notes.setManualTags(noteId, updatedTags);
        // Invalidate queries so sidebar and note list update
        void queryClient.invalidateQueries({ queryKey: noteKeys.tags() });
        void queryClient.invalidateQueries({ queryKey: noteKeys.lists() });

        // Refetch note to sync selectedNote state with updated tags
        if (onNoteUpdate) {
          const result = await window.dripnex.notes.get(noteId);
          if (result.ok) {
            onNoteUpdate(result.data);
          }
        }
      } catch (error) {
        console.error('Failed to save manual tags:', error);
        // Revert on error
        setManualTags(previousTags);
      }
    },
    [noteId, manualTags, queryClient, onNoteUpdate]
  );

  // Combine inline and manual tags (deduplicated and sorted)
  const displayTags = [...new Set([...inlineTags, ...manualTags])].sort();

  return {
    manualTags,
    displayTags,
    addTag,
    removeTag,
  };
}
