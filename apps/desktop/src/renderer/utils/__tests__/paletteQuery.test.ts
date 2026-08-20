import { describe, expect, it } from 'vitest';
import {
  filterByQuery,
  fuzzyScore,
  notebookPath,
  palettePlaceholder,
  parsePaletteQuery,
} from '../paletteQuery';

describe('filterByQuery', () => {
  it('returns all items when the query is empty', () => {
    expect(filterByQuery(['Inbox', 'Work'], '  ', s => s)).toEqual(['Inbox', 'Work']);
  });

  it('filters case-insensitively', () => {
    expect(filterByQuery(['Inbox', 'Work', 'Weekly'], 'wo', s => s)).toEqual(['Work']);
  });
});

describe('notebookPath', () => {
  const tree = [
    { id: 'inbox', name: 'Inbox', parentId: null },
    { id: 'work', name: 'Work', parentId: null },
    { id: 'api', name: 'API', parentId: 'work' },
  ];

  it('joins ancestors with a slash', () => {
    expect(notebookPath(tree, 'api')).toBe('Work / API');
    expect(notebookPath(tree, 'inbox')).toBe('Inbox');
  });
});

describe('parsePaletteQuery', () => {
  it('scopes on prefix plus space', () => {
    expect(parsePaletteQuery('b Work', 'commands')).toEqual({
      source: 'notebooks',
      needle: 'Work',
      scoped: true,
    });
    expect(parsePaletteQuery('t tips', 'commands').source).toBe('tags');
    expect(parsePaletteQuery('> sort', 'notes').source).toBe('commands');
    expect(parsePaletteQuery('# intro', 'commands').source).toBe('headings');
  });

  it('does not treat "blog" as the notebooks prefix', () => {
    expect(parsePaletteQuery('blog', 'commands')).toEqual({
      source: 'commands',
      needle: 'blog',
      scoped: false,
    });
  });
});

describe('fuzzyScore', () => {
  it('ranks a prefix above a subsequence', () => {
    const prefix = fuzzyScore('Inbox', 'in');
    const sub = fuzzyScore('Pinned', 'in');
    expect(prefix).not.toBeNull();
    expect(sub).not.toBeNull();
    expect(prefix!).toBeGreaterThan(sub!);
  });

  it('ranks a long prefix above a short substring', () => {
    const prefix = fuzzyScore(`Intro ${'x'.repeat(900)}`, 'intro');
    const sub = fuzzyScore('xintro', 'intro');
    expect(prefix).not.toBeNull();
    expect(sub).not.toBeNull();
    expect(prefix!).toBeGreaterThan(sub!);
  });

  it('rejects a query that is not a subsequence', () => {
    expect(fuzzyScore('Weekly', 'wo')).toBeNull();
  });
});

describe('palettePlaceholder', () => {
  it('names each mode', () => {
    expect(palettePlaceholder('notes')).toContain('note');
    expect(palettePlaceholder('notebooks')).toContain('notebook');
    expect(palettePlaceholder('tags')).toContain('tag');
    expect(palettePlaceholder('headings')).toContain('heading');
  });
});
