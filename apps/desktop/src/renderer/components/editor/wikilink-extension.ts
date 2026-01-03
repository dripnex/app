/**
 * CodeMirror extension for wikilink [[note]] syntax highlighting
 *
 * Highlights [[target]] and [[target|display]] patterns in the editor.
 * Does NOT handle click navigation - that's the preview's job.
 */

import { ViewPlugin, Decoration, DecorationSet, EditorView } from '@codemirror/view';
import type { ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Pattern: [[target]] or [[target|display]]
const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

const wikilinkMark = Decoration.mark({ class: 'cm-wikilink' });

const wikilinkTheme = EditorView.baseTheme({
  '.cm-wikilink': {
    color: '#5eead4',
    borderBottom: '1px solid rgba(94, 234, 212, 0.3)',
    borderRadius: '2px',
  },
});

class WikilinkHighlighter {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.build(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.build(update.view);
    }
  }

  build(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const { from, to } = view.viewport;
    const text = view.state.sliceDoc(from, to);

    // IMPORTANTE: resetear lastIndex para regex global
    WIKILINK_PATTERN.lastIndex = 0;

    let match;
    while ((match = WIKILINK_PATTERN.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;
      builder.add(start, end, wikilinkMark);
    }

    return builder.finish();
  }
}

const wikilinkHighlighter = ViewPlugin.fromClass(WikilinkHighlighter, {
  decorations: v => v.decorations,
});

export const wikilinkExtension = [wikilinkTheme, wikilinkHighlighter];
