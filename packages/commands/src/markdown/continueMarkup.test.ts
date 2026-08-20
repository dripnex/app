import { describe, it, expect, vi } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { continueMarkup, nextMarkupPrefix, outdentMarkupLine } from './continueMarkup.js';

function fakeView(initialDoc: string, selection: { from: number; to: number }) {
  let state = EditorState.create({
    doc: initialDoc,
    selection: EditorSelection.range(selection.from, selection.to),
  });
  const dispatch = vi.fn((spec: Parameters<EditorView['dispatch']>[0]) => {
    state = state.update(spec).state;
  });
  const view = {
    get state() {
      return state;
    },
    dispatch,
  };
  return {
    view: view as unknown as EditorView,
    doc: () => state.doc.toString(),
    cursor: () => state.selection.main.head,
  };
}

describe('nextMarkupPrefix', () => {
  it('continues a bullet', () => {
    expect(nextMarkupPrefix('- item')).toEqual({ prefix: '- ', empty: false });
  });

  it('continues an ordered item and bumps the number', () => {
    expect(nextMarkupPrefix('1. item')).toEqual({ prefix: '2. ', empty: false });
  });

  it('continues a task unchecked', () => {
    expect(nextMarkupPrefix('- [x] done')).toEqual({ prefix: '- [ ] ', empty: false });
  });

  it('continues a quote', () => {
    expect(nextMarkupPrefix('> hello')).toEqual({ prefix: '> ', empty: false });
  });

  it('marks empty items', () => {
    expect(nextMarkupPrefix('- ')?.empty).toBe(true);
    expect(nextMarkupPrefix('> ')?.empty).toBe(true);
  });
});

describe('outdentMarkupLine', () => {
  it('clears a top-level empty bullet', () => {
    expect(outdentMarkupLine('- ')).toBe('');
  });

  it('outdents a nested bullet by two spaces', () => {
    expect(outdentMarkupLine('  - ')).toBe('- ');
  });

  it('drops a list inside a quote and keeps the quote', () => {
    expect(outdentMarkupLine('> - ')).toBe('> ');
  });
});

describe('continueMarkup', () => {
  it('inserts a sibling bullet and splits the line', () => {
    const t = fakeView('- hello', { from: 5, to: 5 });
    expect(continueMarkup(t.view)).toBe(true);
    expect(t.doc()).toBe('- hel\n- lo');
  });

  it('continues an ordered list and renumbers what follows', () => {
    const t = fakeView('1. a\n2. b', { from: 4, to: 4 });
    expect(continueMarkup(t.view)).toBe(true);
    expect(t.doc()).toBe('1. a\n2. \n3. b');
  });

  it('exits an empty list item', () => {
    const t = fakeView('- ', { from: 2, to: 2 });
    expect(continueMarkup(t.view)).toBe(true);
    expect(t.doc()).toBe('');
  });

  it('continues a blockquote', () => {
    const t = fakeView('> hi', { from: 4, to: 4 });
    expect(continueMarkup(t.view)).toBe(true);
    expect(t.doc()).toBe('> hi\n> ');
  });

  it('does not steal Enter inside a fence', () => {
    const doc = '```\n- not a list\n```';
    const t = fakeView(doc, { from: 6, to: 6 });
    expect(continueMarkup(t.view)).toBe(false);
    expect(t.doc()).toBe(doc);
  });

  it('falls through when the line is not markup', () => {
    const t = fakeView('plain', { from: 5, to: 5 });
    expect(continueMarkup(t.view)).toBe(false);
  });

  it('falls through when there is a selection', () => {
    const t = fakeView('- hello', { from: 2, to: 7 });
    expect(continueMarkup(t.view)).toBe(false);
  });
});
