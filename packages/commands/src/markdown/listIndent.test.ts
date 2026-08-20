import { describe, it, expect, vi } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import {
  parseListLine,
  formatListLine,
  indentList,
  indentListItem,
  dedentListItem,
  fencesByLine,
} from './listIndent.js';

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
    selectionMain: () => state.selection.main,
  };
}

function indent(doc: string, line: number, direction: 1 | -1 = 1): string | null {
  const next = indentList(doc, [line], direction);
  return next ? next.join('\n') : null;
}

describe('parseListLine', () => {
  it('parses bullets with marker width 2', () => {
    const p = parseListLine('- item');
    expect(p).toMatchObject({
      kind: 'bullet',
      bullet: '-',
      indent: 0,
      markerWidth: 2,
      rest: 'item',
    });
  });

  it('parses 1. with marker width 3', () => {
    const p = parseListLine('1. item');
    expect(p).toMatchObject({ kind: 'ordered', number: 1, delimiter: '.', markerWidth: 3 });
  });

  it('parses 10. with marker width 4', () => {
    const p = parseListLine('10. item');
    expect(p).toMatchObject({ kind: 'ordered', number: 10, markerWidth: 4 });
  });

  it('parses 1) delimiters', () => {
    const p = parseListLine('1) item');
    expect(p).toMatchObject({ delimiter: ')', markerWidth: 3 });
  });

  it('parses task items without counting the checkbox in marker width', () => {
    const p = parseListLine('- [ ] task');
    expect(p).toMatchObject({ kind: 'bullet', markerWidth: 2, task: ' [ ]', rest: 'task' });
    expect(formatListLine(p!, 0)).toBe('- [ ] task');
  });

  it('counts leading spaces as indent', () => {
    expect(parseListLine('   - nested')?.indent).toBe(3);
  });

  it('rejects a marker without a following space', () => {
    expect(parseListLine('-item')).toBeNull();
    expect(parseListLine('1.item')).toBeNull();
  });
});

describe('fencesByLine', () => {
  it('marks fenced contents, not the opening fence', () => {
    const inside = fencesByLine(['para', '```js', '- not a list', '```', '- list']);
    expect(inside).toEqual([false, false, true, true, false]);
  });
});

describe('indentList', () => {
  it('nests a bullet under a numbered item by 3 spaces', () => {
    expect(indent('1. This is a line of text.\n- This is a bullet.', 2)).toBe(
      '1. This is a line of text.\n   - This is a bullet.'
    );
  });

  it('nests under 10. by 4 spaces', () => {
    expect(indent('10. parent\n- child', 2)).toBe('10. parent\n    - child');
  });

  it('nests a numbered item under a bullet by 2 spaces', () => {
    expect(indent('- parent\n1. child', 2)).toBe('- parent\n  1. child');
  });

  it('Shift-Tab reverses a nest under a numbered item', () => {
    expect(indent('1. parent\n   - child', 2, -1)).toBe('1. parent\n- child');
  });

  it('renumbers when a numbered item nests under the previous', () => {
    expect(indent('1. first\n2. second\n3. third', 2)).toBe('1. first\n   1. second\n2. third');
  });

  it('renumbers when a nested numbered item is lifted', () => {
    expect(indent('1. first\n   1. second\n2. third', 2, -1)).toBe('1. first\n2. second\n3. third');
  });

  it('starts a nested numbered list at 1', () => {
    expect(indent('1. parent\n2. child', 2)).toBe('1. parent\n   1. child');
  });

  it('indents a first list item by its own marker width', () => {
    expect(indent('- only', 1)).toBe('  - only');
    expect(indent('1. only', 1)).toBe('   1. only');
  });

  it('does nothing when Shift-Tab is on a top-level item', () => {
    expect(indent('- only', 1, -1)).toBeNull();
  });

  it('skips list-looking lines inside a fence', () => {
    expect(indent('```\n- code\n```', 2)).toBeNull();
  });

  it('moves descendants with the parent', () => {
    expect(indent('- a\n  - b\n    - c\n- d', 1)).toBe('  - a\n    - b\n      - c\n- d');
  });

  it('does not double-indent a selected child of a selected parent', () => {
    const next = indentList('- a\n  - b', [1, 2], 1);
    expect(next?.join('\n')).toBe('  - a\n    - b');
  });

  it('does not double-indent a selected grandchild of a selected ancestor', () => {
    const next = indentList('- a\n  - b\n    - c', [1, 3], 1);
    expect(next?.join('\n')).toBe('  - a\n    - b\n      - c');
  });

  it('nests several selected siblings under the item above', () => {
    const next = indentList('1. a\n2. b\n3. c', [2, 3], 1);
    expect(next?.join('\n')).toBe('1. a\n   1. b\n   2. c');
  });

  it('preserves task checkboxes', () => {
    expect(indent('- [ ] parent\n- [x] child', 2)).toBe('- [ ] parent\n  - [x] child');
  });

  it('indents continuation lines with the item', () => {
    expect(indent('- parent\n- child\n  continued', 2)).toBe('- parent\n  - child\n    continued');
  });
});

describe('indentListItem command', () => {
  it('keeps the cursor on the same text after indenting', () => {
    const doc = '1. parent\n- child';
    // cursor on 'c' of child
    const t = fakeView(doc, { from: 12, to: 12 });
    expect(indentListItem(t.view)).toBe(true);
    expect(t.doc()).toBe('1. parent\n   - child');
    expect(t.selectionMain().from).toBe(15);
  });

  it('returns false outside a list so Tab can fall through', () => {
    const t = fakeView('plain text', { from: 0, to: 0 });
    expect(indentListItem(t.view)).toBe(false);
    expect(dedentListItem(t.view)).toBe(false);
  });
});
