import { describe, expect, it } from 'vitest';
import { filterByQuery, notebookPath, palettePlaceholder } from '../paletteQuery';

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

describe('palettePlaceholder', () => {
  it('names each mode', () => {
    expect(palettePlaceholder('notes')).toContain('note');
    expect(palettePlaceholder('notebooks')).toContain('notebook');
    expect(palettePlaceholder('tags')).toContain('tag');
    expect(palettePlaceholder('headings')).toContain('heading');
  });
});
