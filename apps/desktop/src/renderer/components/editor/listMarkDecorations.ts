/**
 * Color Markdown list markers by nesting depth.
 *
 * Level 1 uses `--md-list-mark-color`; levels 2 and 3 use the matching
 * tokens; deeper levels cycle. Only the marker is colored.
 */

import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view';

export function listMarkLevelClass(depth: number): string {
  const cycle = ((Math.max(1, depth) - 1) % 3) + 1;
  if (cycle === 1) return 'md-list-mark';
  return `md-list-mark md-list-mark-${cycle}`;
}

function listMarkDecorations(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'ListMark') return;
        let depth = 0;
        let parent = node.node.parent;
        while (parent) {
          if (parent.name === 'ListItem') depth += 1;
          parent = parent.parent;
        }
        if (depth < 1) depth = 1;
        builder.add(node.from, node.to, Decoration.mark({ class: listMarkLevelClass(depth) }));
      },
    });
  }
  return builder.finish();
}

export const listMarkHighlighter = ViewPlugin.fromClass(
  class {
    decorations = Decoration.none;

    constructor(view: EditorView) {
      this.decorations = listMarkDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = listMarkDecorations(update.view);
      }
    }
  },
  { decorations: value => value.decorations }
);
