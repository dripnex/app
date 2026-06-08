import { describe, it, expect, vi } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleInlineCode,
  insertHeading,
  insertUnorderedList,
  insertOrderedList,
  insertCheckbox,
  insertQuote,
  insertCodeBlock,
  insertHorizontalRule,
} from './commands.js';

// CodeMirror commands need an EditorView to call view.dispatch + view.focus.
// We fake one with just the surface area the command functions touch — no DOM.
function fakeView(initialDoc: string, selection: { from: number; to: number }) {
  let state = EditorState.create({
    doc: initialDoc,
    selection: EditorSelection.range(selection.from, selection.to),
  });
  const focus = vi.fn();
  const dispatch = vi.fn((spec: Parameters<EditorView['dispatch']>[0]) => {
    state = state.update(spec).state;
  });
  const view = {
    get state() {
      return state;
    },
    dispatch,
    focus,
  };
  return {
    view: view as unknown as EditorView,
    doc: () => state.doc.toString(),
    selectionMain: () => state.selection.main,
    dispatchCalls: () => dispatch.mock.calls.length,
  };
}

describe('@readied/commands markdown', () => {
  describe('wrapping commands', () => {
    it('toggleBold wraps selected text with **', () => {
      const t = fakeView('hello world', { from: 0, to: 5 });
      toggleBold(t.view);
      expect(t.doc()).toBe('**hello** world');
    });

    it('toggleBold unwraps when applied to already-bold text', () => {
      const t = fakeView('**hello** world', { from: 2, to: 7 });
      toggleBold(t.view);
      expect(t.doc()).toBe('hello world');
    });

    it('toggleItalic wraps with single asterisks', () => {
      const t = fakeView('hello', { from: 0, to: 5 });
      toggleItalic(t.view);
      expect(t.doc()).toBe('*hello*');
    });

    it('toggleStrikethrough wraps with ~~', () => {
      const t = fakeView('hello', { from: 0, to: 5 });
      toggleStrikethrough(t.view);
      expect(t.doc()).toBe('~~hello~~');
    });

    it('toggleInlineCode wraps with backticks', () => {
      const t = fakeView('hello', { from: 0, to: 5 });
      toggleInlineCode(t.view);
      expect(t.doc()).toBe('`hello`');
    });
  });

  describe('line-prefix commands', () => {
    it('insertHeading prepends ## by default (level 2)', () => {
      const t = fakeView('title', { from: 0, to: 0 });
      insertHeading(t.view);
      expect(t.doc()).toBe('## title');
    });

    it('insertHeading respects explicit level', () => {
      const t = fakeView('title', { from: 0, to: 0 });
      insertHeading(t.view, 4);
      expect(t.doc()).toBe('#### title');
    });

    it('insertUnorderedList prepends - to the line', () => {
      const t = fakeView('item', { from: 0, to: 0 });
      insertUnorderedList(t.view);
      expect(t.doc()).toBe('- item');
    });

    it('insertOrderedList prepends 1. to the line', () => {
      const t = fakeView('item', { from: 0, to: 0 });
      insertOrderedList(t.view);
      expect(t.doc()).toBe('1. item');
    });

    it('insertCheckbox prepends - [ ] to the line', () => {
      const t = fakeView('task', { from: 0, to: 0 });
      insertCheckbox(t.view);
      expect(t.doc()).toBe('- [ ] task');
    });

    it('insertQuote prepends > to the line', () => {
      const t = fakeView('quoted', { from: 0, to: 0 });
      insertQuote(t.view);
      expect(t.doc()).toBe('> quoted');
    });
  });

  describe('block-insertion commands', () => {
    it('insertCodeBlock inserts a fenced code block', () => {
      const t = fakeView('', { from: 0, to: 0 });
      insertCodeBlock(t.view);
      expect(t.doc()).toContain('```');
    });

    it('insertHorizontalRule inserts a markdown rule', () => {
      const t = fakeView('', { from: 0, to: 0 });
      insertHorizontalRule(t.view);
      expect(t.doc()).toContain('---');
    });
  });
});
