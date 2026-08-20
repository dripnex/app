import { describe, it, expect, vi } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import {
  joinLines,
  sortLines,
  sortLinesInsensitive,
  reverseSortLines,
  insertLineBefore,
  upcaseAtCursor,
  downcaseAtCursor,
  findUnder,
  findUnderPrevious,
  skipAndSelectNextOccurrence,
  splitSelectionByLine,
  wordRangeAt,
} from './lineCommands.js';

function fakeView(initialDoc: string, selection: { from: number; to: number }) {
  let state = EditorState.create({
    doc: initialDoc,
    selection: EditorSelection.range(selection.from, selection.to),
    extensions: [EditorState.allowMultipleSelections.of(true)],
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
    selection: () => state.selection.main,
  };
}

describe('wordRangeAt', () => {
  it('expands around the cursor', () => {
    const state = EditorState.create({ doc: 'hello world' });
    expect(wordRangeAt(state.doc, 2)).toEqual({ from: 0, to: 5 });
  });
});

describe('joinLines', () => {
  it('joins the next line when nothing is selected', () => {
    const t = fakeView('hello\n  world', { from: 0, to: 0 });
    expect(joinLines(t.view)).toBe(true);
    expect(t.doc()).toBe('hello world');
  });

  it('joins a multi-line selection and drops absorbed indent', () => {
    const t = fakeView('a\n  b\n  c', { from: 0, to: 9 });
    expect(joinLines(t.view)).toBe(true);
    expect(t.doc()).toBe('a b c');
  });

  it('does nothing on the last line with an empty selection', () => {
    const t = fakeView('only', { from: 4, to: 4 });
    expect(joinLines(t.view)).toBe(false);
  });
});

describe('sortLines', () => {
  it('does not rewrite a single-line selection', () => {
    const t = fakeView('b\na', { from: 0, to: 1 });
    expect(sortLines(t.view)).toBe(false);
  });

  it('sorts the selected lines', () => {
    const t = fakeView('b\na\nc', { from: 0, to: 5 });
    expect(sortLines(t.view)).toBe(true);
    expect(t.doc()).toBe('a\nb\nc');
  });

  it('sorts case-insensitively and reverse', () => {
    const t = fakeView('B\na\nC', { from: 0, to: 5 });
    expect(sortLinesInsensitive(t.view)).toBe(true);
    expect(t.doc()).toBe('a\nB\nC');
    const r = fakeView('a\nb\nc', { from: 0, to: 5 });
    expect(reverseSortLines(r.view)).toBe(true);
    expect(r.doc()).toBe('c\nb\na');
  });
});

describe('insertLineBefore', () => {
  it('opens an indented blank line above', () => {
    const t = fakeView('  hello', { from: 4, to: 4 });
    expect(insertLineBefore(t.view)).toBe(true);
    expect(t.doc()).toBe('  \n  hello');
    expect(t.selection().head).toBe(2);
  });
});

describe('case at cursor', () => {
  it('uppercases the word at the cursor', () => {
    const t = fakeView('hello world', { from: 1, to: 1 });
    expect(upcaseAtCursor(t.view)).toBe(true);
    expect(t.doc()).toBe('HELLO world');
  });

  it('lowercases a selection', () => {
    const t = fakeView('HELLO', { from: 0, to: 5 });
    expect(downcaseAtCursor(t.view)).toBe(true);
    expect(t.doc()).toBe('hello');
  });
});

describe('findUnder', () => {
  it('jumps to the next occurrence of the word', () => {
    const t = fakeView('foo bar foo', { from: 1, to: 1 });
    expect(findUnder(t.view)).toBe(true);
    expect(t.selection().from).toBe(8);
    expect(t.selection().to).toBe(11);
  });

  it('wraps around the note', () => {
    const t = fakeView('foo bar foo', { from: 8, to: 11 });
    expect(findUnder(t.view)).toBe(true);
    expect(t.selection().from).toBe(0);
  });

  it('wraps backward from the first occurrence to the last', () => {
    const t = fakeView('foo bar foo', { from: 0, to: 3 });
    expect(findUnderPrevious(t.view)).toBe(true);
    expect(t.selection().from).toBe(8);
    expect(t.selection().to).toBe(11);
  });
});

describe('skipAndSelectNextOccurrence', () => {
  it('expands an empty selection to the word first', () => {
    const t = fakeView('foo bar foo', { from: 1, to: 1 });
    expect(skipAndSelectNextOccurrence(t.view)).toBe(true);
    expect(t.selection().from).toBe(0);
    expect(t.selection().to).toBe(3);
  });
});

describe('splitSelectionByLine', () => {
  it('puts a range on each covered line', () => {
    const t = fakeView('a\nb\nc', { from: 0, to: 5 });
    expect(splitSelectionByLine(t.view)).toBe(true);
    expect(t.view.state.selection.ranges).toHaveLength(3);
  });

  it('does not add a caret on a line that is only the selection end', () => {
    const t = fakeView('a\nb\nc', { from: 0, to: 4 });
    expect(splitSelectionByLine(t.view)).toBe(true);
    expect(t.view.state.selection.ranges).toHaveLength(2);
  });
});
