import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  GRAPH_EMPTY_HINT,
  GRAPH_EMPTY_TITLE,
  GRAPH_ERROR_HINT,
  GRAPH_ERROR_TITLE,
  GRAPH_FILTER_EMPTY_HINT,
  GRAPH_FILTER_EMPTY_TITLE,
  graphFilterEmpty,
} from '../graphCopy';

const here = dirname(fileURLToPath(import.meta.url));
const graphSrc = readFileSync(join(here, '../GraphView.tsx'), 'utf8');

describe('graph copy', () => {
  it('explains a filter with no matches', () => {
    expect(graphFilterEmpty('alpha', 0)).toEqual({
      title: GRAPH_FILTER_EMPTY_TITLE,
      hint: GRAPH_FILTER_EMPTY_HINT,
    });
    expect(GRAPH_FILTER_EMPTY_TITLE).toBe('No matches');
    expect(GRAPH_FILTER_EMPTY_HINT).toBe('Try a different search');
  });

  it('stays quiet when the filter is idle or has hits', () => {
    expect(graphFilterEmpty('', 0)).toBeNull();
    expect(graphFilterEmpty('   ', 0)).toBeNull();
    expect(graphFilterEmpty('alpha', null)).toBeNull();
    expect(graphFilterEmpty('alpha', 3)).toBeNull();
  });

  it('wires empty, error, and filter-empty copy into GraphView', () => {
    expect(graphSrc).toContain('GRAPH_EMPTY_TITLE');
    expect(graphSrc).toContain('GRAPH_ERROR_TITLE');
    expect(graphSrc).toContain('graphFilterEmpty');
    expect(GRAPH_EMPTY_TITLE).toBe('No notes to map');
    expect(GRAPH_EMPTY_HINT).toContain('[[wikilinks]]');
    expect(GRAPH_ERROR_TITLE).toBe('Failed to load graph');
    expect(GRAPH_ERROR_HINT).toContain('indexed');
  });
});
