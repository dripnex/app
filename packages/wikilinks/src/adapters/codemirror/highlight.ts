/**
 * CodeMirror extension for wikilink [[note]] syntax highlighting.
 * Cmd/Ctrl-click navigation lives in click.ts.
 */

import { ViewPlugin, Decoration, DecorationSet, EditorView } from '@codemirror/view';
import type { ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { RangeSetBuilder } from '@codemirror/state';
import { findWikilinkSpans } from '../../core/parsing.js';

const wikilinkMark = Decoration.mark({ class: 'cm-wikilink' });
const missingMark = Decoration.mark({ class: 'cm-wikilink cm-wikilink-missing' });

const wikilinkTheme = EditorView.baseTheme({
  '.cm-wikilink': {
    color: 'var(--accent)',
    borderBottom: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
    borderRadius: '2px',
    cursor: 'pointer',
  },
  '.cm-wikilink-missing': {
    color: 'var(--text-secondary)',
    borderBottomStyle: 'dashed',
    borderBottomColor: 'color-mix(in srgb, var(--text-secondary) 40%, transparent)',
  },
});

export function createWikilinkHighlighter(
  knownTitles: ReadonlySet<string> | null = null
): Extension {
  const known =
    knownTitles == null ? null : new Set([...knownTitles].map(title => title.toLowerCase()));
  const highlighter = ViewPlugin.fromClass(
    class {
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
        for (const span of findWikilinkSpans(text)) {
          const target = span.ref.target;
          const missing = known != null && Boolean(target) && !known.has(target.toLowerCase());
          builder.add(from + span.start, from + span.end, missing ? missingMark : wikilinkMark);
        }
        return builder.finish();
      }
    },
    { decorations: v => v.decorations }
  );
  return [wikilinkTheme, highlighter];
}

export const wikilinkExtension = createWikilinkHighlighter();
