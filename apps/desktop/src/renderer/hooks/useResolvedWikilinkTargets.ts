import { useEffect, useMemo, useState } from 'react';
import { extractWikilinkTargets } from '@dripnex/wikilinks';

/** Lowercase titles from this note's wikilinks that already exist. Null while loading. */
export function useResolvedWikilinkTargets(content: string): Set<string> | null {
  const key = useMemo(
    () =>
      extractWikilinkTargets(content)
        .map(title => title.toLowerCase())
        .sort()
        .join('\n'),
    [content]
  );
  const [known, setKnown] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!key) {
      setKnown(new Set());
      return;
    }
    setKnown(null);
    let cancelled = false;
    const titles = key.split('\n');
    const timer = window.setTimeout(() => {
      void (async () => {
        const found = new Set<string>();
        await Promise.all(
          titles.map(async title => {
            const notes = await window.dripnex.notes.search(title, 8);
            if (notes.some(note => note.title.toLowerCase() === title)) {
              found.add(title);
            }
          })
        );
        if (!cancelled) setKnown(found);
      })();
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key]);

  return known;
}
