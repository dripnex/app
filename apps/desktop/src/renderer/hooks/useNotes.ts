import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ListOptions,
  NoteStatus,
  BoardStage,
  NotePriority,
  NoteSnapshot,
} from '../../preload/index';

// ============================================================================
// Excerpt Helper (shared between filtered notes and search results)
// ============================================================================

/** Extract excerpt from note content */
export function extractExcerpt(content: string, maxLength: number = 100): string {
  return content
    .replace(/^#.*$/m, '') // Remove title heading if present
    .trim()
    .slice(0, maxLength);
}

/** Add excerpt to a note snapshot */
export function withExcerpt<T extends NoteSnapshot>(note: T): T & { excerpt: string } {
  return {
    ...note,
    excerpt: extractExcerpt(note.content),
  };
}

/** Query key factory for notes */
export const noteKeys = {
  all: ['notes'] as const,
  lists: () => [...noteKeys.all, 'list'] as const,
  list: (options?: ListOptions) => [...noteKeys.lists(), options ?? {}] as const,
  details: () => [...noteKeys.all, 'detail'] as const,
  detail: (id: string) => [...noteKeys.details(), id] as const,
  search: (query: string) => [...noteKeys.all, 'search', query] as const,
  tags: () => [...noteKeys.all, 'tags'] as const,
  counts: () => [...noteKeys.all, 'counts'] as const,
  activityStats: () => [...noteKeys.all, 'activityStats'] as const,
};

/** Hook for listing notes */
export function useNotes(options?: ListOptions) {
  return useQuery({
    queryKey: noteKeys.list(options),
    queryFn: () => window.dripnex.notes.list(options),
  });
}

/** Hook for searching notes (returns notes with excerpt) */
export function useSearchNotes(query: string, limit?: number) {
  return useQuery({
    queryKey: noteKeys.search(query),
    queryFn: async () => {
      const notes = await window.dripnex.notes.search(query, limit);
      return notes.map(withExcerpt);
    },
    enabled: query.trim().length > 0,
  });
}

/** Hook for getting a single note */
export function useNote(id: string | null) {
  return useQuery({
    queryKey: noteKeys.detail(id ?? ''),
    queryFn: async () => {
      if (!id) return null;
      const result = await window.dripnex.notes.get(id);
      return result.ok ? result.data : null;
    },
    enabled: !!id,
  });
}

/** Hook for getting all tags */
export function useTags() {
  return useQuery({
    queryKey: noteKeys.tags(),
    queryFn: () => window.dripnex.notes.tags(),
  });
}

/** Hook for getting note counts */
export function useNoteCounts() {
  return useQuery({
    queryKey: noteKeys.counts(),
    queryFn: () => window.dripnex.notes.count(),
  });
}

/** Hook for getting activity stats (heatmap data) */
export function useActivityStats() {
  return useQuery({
    queryKey: noteKeys.activityStats(),
    queryFn: () => window.dripnex.notes.activityStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for getting note count for a specific notebook.
 * Uses the byNotebook counts from the cached count query.
 */
export function useNotebookNotesCount(notebookId: string | null) {
  const { data: counts } = useNoteCounts();

  if (!notebookId || !counts) return 0;

  return (counts as { byNotebook?: Record<string, number> }).byNotebook?.[notebookId] ?? 0;
}

/** Hook for note mutations */
export function useNoteMutations() {
  const queryClient = useQueryClient();

  const invalidateNotes = () => {
    void queryClient.invalidateQueries({ queryKey: noteKeys.all });
  };

  const createNote = useMutation({
    mutationFn: async (input: { content: string; id?: string; notebookId?: string }) => {
      const result = await window.dripnex.notes.create(input);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const updateNote = useMutation({
    mutationFn: async (input: { id: string; content: string }) => {
      const result = await window.dripnex.notes.update(input);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: data => {
      queryClient.setQueryData(noteKeys.detail(data.id), data);
      void queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
    },
  });

  const updateNoteTitle = useMutation({
    mutationFn: async (input: { id: string; title: string }) => {
      const result = await window.dripnex.notes.updateTitle(input);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: data => {
      queryClient.setQueryData(noteKeys.detail(data.id), data);
      void queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const result = await window.dripnex.notes.delete(id);
      if (!result.ok) throw new Error(result.error.type);
    },
    onSuccess: () => invalidateNotes(),
  });

  const archiveNote = useMutation({
    mutationFn: async (id: string) => {
      const result = await window.dripnex.notes.archive(id);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const restoreNote = useMutation({
    mutationFn: async (id: string) => {
      const result = await window.dripnex.notes.restore(id);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const duplicateNote = useMutation({
    mutationFn: async (id: string) => {
      const result = await window.dripnex.notes.duplicate(id);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const moveNote = useMutation({
    mutationFn: async ({ noteId, notebookId }: { noteId: string; notebookId: string }) => {
      const result = await window.dripnex.notes.move(noteId, notebookId);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const pinNote = useMutation({
    mutationFn: async (id: string) => {
      const result = await window.dripnex.notes.pin(id);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const unpinNote = useMutation({
    mutationFn: async (id: string) => {
      const result = await window.dripnex.notes.unpin(id);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const softDeleteNote = useMutation({
    mutationFn: async (id: string) => {
      const result = await window.dripnex.notes.softDelete(id);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const restoreDeletedNote = useMutation({
    mutationFn: async (id: string) => {
      const result = await window.dripnex.notes.restoreDeleted(id);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const setNoteStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: NoteStatus }) => {
      const result = await window.dripnex.notes.setStatus(id, status);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const setBoardStage = useMutation({
    mutationFn: async ({ id, boardStage }: { id: string; boardStage: BoardStage | null }) => {
      const result = await window.dripnex.notes.setBoardStage(id, boardStage);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const setPriority = useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: NotePriority }) => {
      const result = await window.dripnex.notes.setPriority(id, priority);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  return {
    createNote,
    updateNote,
    updateNoteTitle,
    deleteNote,
    archiveNote,
    restoreNote,
    duplicateNote,
    moveNote,
    pinNote,
    unpinNote,
    softDeleteNote,
    restoreDeletedNote,
    setNoteStatus,
    setBoardStage,
    setPriority,
  };
}
