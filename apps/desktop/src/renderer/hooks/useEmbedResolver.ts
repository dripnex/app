import { useState, useEffect, useCallback } from 'react';
import { extractEmbedTargets } from '@dripnex/embeds';

interface UseEmbedResolverOptions {
  noteId: string | null;
  content: string | null;
}

interface UseEmbedResolverResult {
  /** Map of embed target to resolved URL (null if not resolvable) */
  resolvedEmbeds: Record<string, string | null>;
  /** Get URL for an embed target (handles external URLs too) */
  getEmbedUrl: (target: string) => string | null;
}

/**
 * Hook for resolving embed targets to URLs.
 *
 * Handles both local embeds (resolved via IPC) and external URLs.
 * Results are cached per note and only re-resolved when content changes.
 */
export function useEmbedResolver({
  noteId,
  content,
}: UseEmbedResolverOptions): UseEmbedResolverResult {
  const [resolvedEmbeds, setResolvedEmbeds] = useState<Record<string, string | null>>({});

  // Resolve embeds when note content changes
  useEffect(() => {
    if (!noteId || !content) {
      setResolvedEmbeds({});
      return;
    }

    const targets = extractEmbedTargets(content);
    if (targets.length === 0) {
      setResolvedEmbeds({});
      return;
    }

    // Only resolve local targets (external URLs don't need IPC)
    const localTargets = targets.filter(t => !t.startsWith('http://') && !t.startsWith('https://'));

    if (localTargets.length === 0) {
      // All external, no IPC needed
      setResolvedEmbeds({});
      return;
    }

    // Capture noteId for async closure
    const currentNoteId = noteId;

    let cancelled = false;
    window.dripnex.embeds
      .resolveBatch(localTargets, currentNoteId)
      .then(result => {
        if (!cancelled) setResolvedEmbeds(result);
      })
      .catch(() => {
        if (!cancelled) setResolvedEmbeds({});
      });

    return () => {
      cancelled = true;
    };
  }, [noteId, content]);

  // Callback for getting resolved embed URLs
  const getEmbedUrl = useCallback(
    (target: string): string | null => {
      // External URLs return themselves
      if (target.startsWith('http://') || target.startsWith('https://')) {
        return target;
      }
      return resolvedEmbeds[target] ?? null;
    },
    [resolvedEmbeds]
  );

  return {
    resolvedEmbeds,
    getEmbedUrl,
  };
}
