import { describe, expect, it } from 'vitest';
import { matchNotebookId, parseNoteSearch } from '../parseNoteSearch';

describe('parseNoteSearch', () => {
  it('returns free text when there are no operators', () => {
    expect(parseNoteSearch('habit tracker')).toEqual({
      text: 'habit tracker',
      tags: [],
      status: null,
      notebook: null,
      pinned: null,
      trash: null,
      archived: null,
    });
  });

  it('extracts tag: and #tag operators', () => {
    expect(parseNoteSearch('tag:work #bug habit')).toMatchObject({
      text: 'habit',
      tags: ['work', 'bug'],
      status: null,
    });
  });

  it('extracts status aliases', () => {
    expect(parseNoteSearch('status:on-hold table')).toMatchObject({
      text: 'table',
      status: 'on_hold',
    });
  });

  it('extracts notebook, pin and trash operators', () => {
    expect(parseNoteSearch('notebook:Inbox is:pinned is:trash')).toEqual({
      text: '',
      tags: [],
      status: null,
      notebook: 'inbox',
      pinned: true,
      trash: true,
      archived: null,
    });
  });

  it('treats in:trash as trash, not a notebook named trash', () => {
    expect(parseNoteSearch('in:trash old')).toMatchObject({
      text: 'old',
      trash: true,
      notebook: null,
    });
  });

  it('allows operators with no remaining text', () => {
    expect(parseNoteSearch('tag:personal status:active')).toMatchObject({
      text: '',
      tags: ['personal'],
      status: 'active',
    });
  });

  it('resolves notebook names and slugs', () => {
    const notebooks = [
      { id: 'nb1', name: 'Inbox' },
      { id: 'nb2', name: 'Side Projects' },
    ];
    expect(matchNotebookId('inbox', notebooks)).toBe('nb1');
    expect(matchNotebookId('side-projects', notebooks)).toBe('nb2');
    expect(matchNotebookId('nb2', notebooks)).toBe('nb2');
    expect(matchNotebookId('missing', notebooks)).toBeUndefined();
  });
});
