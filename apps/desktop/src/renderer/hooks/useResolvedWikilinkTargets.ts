import { useEffect, useMemo, useState } from 'react';
import { extractWikilinkTargets } from '@dripnex/wikilinks';
import type { WikilinkTitleResolution } from '../utils/isMissingWikilink';

export type { WikilinkTitleResolution };

/** Lowercase titles from this note's wikilinks that already exist. */
export function useResolvedWikilinkTargets(content: string): WikilinkTitleResolution {
  const key = useMemo(
    () =>
      extractWikilinkTargets(content)
        .map(title => title.toLowerCase())
        .sort()
        .join('\n'),
    [content]
  );
  const [resolution, setResolution] = useState<WikilinkTitleResolution>({ status: 'pending' });

  useEffect(() => {
    if (!key) {
      setResolution({ status: 'ready', titles: new Set() });
      return;
    }
    setResolution({ status: 'pending' });
    let cancelled = false;
    const titles = key.split('\n');
    const timer = window.setTimeout(() => {
      void (async () => {
        const results = await Promise.allSettled(
          titles.map(async title => {
            const notes = await window.dripnex.notes.search(title, 8);
            return notes.some(note => note.title.toLowerCase() === title) ? title : null;
          })
        );
        if (cancelled) return;
        if (results.some(result => result.status === 'rejected')) {
          setResolution({ status: 'error' });
          return;
        }
        const found = new Set<string>();
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) found.add(result.value);
        }
        setResolution({ status: 'ready', titles: found });
      })();
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key]);

  return resolution;
}
