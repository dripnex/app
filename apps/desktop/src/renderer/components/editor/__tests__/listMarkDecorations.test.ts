import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { listMarkLevelClass } from '../listMarkDecorations';

describe('listMarkLevelClass', () => {
  it('cycles every three nesting levels', () => {
    expect(listMarkLevelClass(1)).toBe('md-list-mark');
    expect(listMarkLevelClass(2)).toBe('md-list-mark md-list-mark-2');
    expect(listMarkLevelClass(3)).toBe('md-list-mark md-list-mark-3');
    expect(listMarkLevelClass(4)).toBe('md-list-mark');
    expect(listMarkLevelClass(5)).toBe('md-list-mark md-list-mark-2');
  });
});

describe('lezer markdown list marks', () => {
  it('exposes ListMark nodes at each nesting level', () => {
    const state = EditorState.create({
      doc: '- a\n  - b\n    - c',
      extensions: [markdown()],
    });
    const marks: { from: number; to: number; depth: number }[] = [];
    syntaxTree(state).iterate({
      enter(node) {
        if (node.name !== 'ListMark') return;
        let depth = 0;
        let parent = node.node.parent;
        while (parent) {
          if (parent.name === 'ListItem') depth += 1;
          parent = parent.parent;
        }
        marks.push({ from: node.from, to: node.to, depth });
      },
    });
    expect(marks.map(m => m.depth)).toEqual([1, 2, 3]);
    expect(state.doc.sliceString(marks[0]!.from, marks[0]!.to)).toMatch(/-/);
  });
});
