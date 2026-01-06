/**
 * Links Hooks (Wikilinks / Backlinks)
 *
 * React Query hooks for link-related operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BacklinkInfo, OutgoingLinkInfo, GraphData } from '../../preload/index';

/** Query key factory for links */
export const linkKeys = {
  all: ['links'] as const,
  backlinks: (noteId: string) => [...linkKeys.all, 'backlinks', noteId] as const,
  outgoing: (noteId: string) => [...linkKeys.all, 'outgoing', noteId] as const,
  graph: () => [...linkKeys.all, 'graph'] as const,
};

/**
 * Hook for getting backlinks (notes that link TO this note).
 *
 * @param noteId - The note ID to get backlinks for
 * @returns Query result with array of BacklinkInfo
 */
export function useBacklinks(noteId: string | null) {
  return useQuery({
    queryKey: linkKeys.backlinks(noteId ?? ''),
    queryFn: async (): Promise<BacklinkInfo[]> => {
      if (!noteId) return [];
      return window.readied.links.getBacklinks(noteId);
    },
    enabled: !!noteId,
  });
}

/**
 * Hook for getting outgoing links (notes this note links TO).
 *
 * @param noteId - The note ID to get outgoing links for
 * @returns Query result with array of OutgoingLinkInfo
 */
export function useOutgoingLinks(noteId: string | null) {
  return useQuery({
    queryKey: linkKeys.outgoing(noteId ?? ''),
    queryFn: async (): Promise<OutgoingLinkInfo[]> => {
      if (!noteId) return [];
      return window.readied.links.getOutgoing(noteId);
    },
    enabled: !!noteId,
  });
}

/**
 * Hook for syncing links.
 * Call this after saving a note to update the links table.
 */
export function useSyncLinks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      await window.readied.links.sync(noteId, content);
    },
    onSuccess: () => {
      // Invalidate all link queries since links may have changed
      queryClient.invalidateQueries({ queryKey: linkKeys.all });
    },
  });
}

/**
 * Hook for getting graph data (all notes and their links).
 * Used for the graph visualization view.
 */
export function useGraphData() {
  return useQuery({
    queryKey: linkKeys.graph(),
    queryFn: async (): Promise<GraphData> => {
      return window.readied.links.getGraph();
    },
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  });
}
