/** Empty / error copy for the knowledge graph. Explain what is missing. */

export const GRAPH_EMPTY_TITLE = 'No notes to map';
export const GRAPH_EMPTY_HINT = 'Create notes and connect them with [[wikilinks]].';

export const GRAPH_ERROR_TITLE = 'Failed to load graph';
export const GRAPH_ERROR_HINT = 'Wikilinks will appear here once notes are indexed.';

export const GRAPH_FILTER_EMPTY_TITLE = 'No matches';
export const GRAPH_FILTER_EMPTY_HINT = 'Try a different search';

/** Filter empty copy when the graph has notes but none match the query. */
export function graphFilterEmpty(
  query: string,
  matchCount: number | null
): { title: string; hint: string } | null {
  if (matchCount === null) return null;
  if (query.trim().length === 0) return null;
  if (matchCount > 0) return null;
  return { title: GRAPH_FILTER_EMPTY_TITLE, hint: GRAPH_FILTER_EMPTY_HINT };
}
