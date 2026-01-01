import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ListOptions } from '../../preload/index';

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
};

/** Hook for listing notes */
export function useNotes(options?: ListOptions) {
  return useQuery({
    queryKey: noteKeys.list(options),
    queryFn: () => window.readied.notes.list(options),
  });
}

/** Hook for searching notes */
export function useSearchNotes(query: string, limit?: number) {
  return useQuery({
    queryKey: noteKeys.search(query),
    queryFn: () => window.readied.notes.search(query, limit),
    enabled: query.trim().length > 0,
  });
}

/** Hook for getting a single note */
export function useNote(id: string | null) {
  return useQuery({
    queryKey: noteKeys.detail(id ?? ''),
    queryFn: async () => {
      if (!id) return null;
      const result = await window.readied.notes.get(id);
      return result.ok ? result.data : null;
    },
    enabled: !!id,
  });
}

/** Hook for getting all tags */
export function useTags() {
  return useQuery({
    queryKey: noteKeys.tags(),
    queryFn: () => window.readied.notes.tags(),
  });
}

/** Hook for getting note counts */
export function useNoteCounts() {
  return useQuery({
    queryKey: noteKeys.counts(),
    queryFn: () => window.readied.notes.count(),
  });
}

/** Hook for note mutations */
export function useNoteMutations() {
  const queryClient = useQueryClient();

  const invalidateNotes = () => {
    queryClient.invalidateQueries({ queryKey: noteKeys.all });
  };

  const createNote = useMutation({
    mutationFn: async (input: { content: string; id?: string }) => {
      const result = await window.readied.notes.create(input);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const updateNote = useMutation({
    mutationFn: async (input: { id: string; content: string }) => {
      const result = await window.readied.notes.update(input);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: data => {
      queryClient.setQueryData(noteKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const result = await window.readied.notes.delete(id);
      if (!result.ok) throw new Error(result.error.type);
    },
    onSuccess: () => invalidateNotes(),
  });

  const archiveNote = useMutation({
    mutationFn: async (id: string) => {
      const result = await window.readied.notes.archive(id);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const restoreNote = useMutation({
    mutationFn: async (id: string) => {
      const result = await window.readied.notes.restore(id);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const duplicateNote = useMutation({
    mutationFn: async (id: string) => {
      const result = await window.readied.notes.duplicate(id);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  const moveNote = useMutation({
    mutationFn: async ({ noteId, notebookId }: { noteId: string; notebookId: string }) => {
      const result = await window.readied.notes.move(noteId, notebookId);
      if (!result.ok) throw new Error(result.error.type);
      return result.data;
    },
    onSuccess: () => invalidateNotes(),
  });

  return {
    createNote,
    updateNote,
    deleteNote,
    archiveNote,
    restoreNote,
    duplicateNote,
    moveNote,
  };
}
