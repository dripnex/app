/**
 * CodeMirror extension for inline image preview of ![[embed]] syntax.
 *
 * Architecture:
 * - Plugin is pure and sync (NO async, NO IPC)
 * - Parent component resolves URLs and passes getUrl callback
 * - Plugin scans for ![[...]] and renders <img> widgets for resolved URLs
 */

import { ViewPlugin, Decoration, WidgetType, EditorView } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Pattern: ![[filename]] or ![[filename|display]]
const EMBED_PATTERN = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Widget that renders an inline image thumbnail in the editor.
 */
class EmbedImageWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly alt: string
  ) {
    super();
  }

  toDOM(): HTMLElement {
    // Wrap in div to make it block-level (full width)
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-embed-wrapper';

    const img = document.createElement('img');
    img.src = this.url;
    img.alt = this.alt;
    img.className = 'cm-embed-preview';
    img.loading = 'lazy';

    wrapper.appendChild(img);
    return wrapper;
  }

  eq(other: EmbedImageWidget): boolean {
    return this.url === other.url && this.alt === other.alt;
  }

  // Prevent cursor from entering the widget
  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Creates a CodeMirror extension for inline embed previews.
 *
 * @param getUrl - Sync function to get resolved URL for a target.
 *                 Returns null if URL is not resolved yet.
 */
export function embedInlinePreview(getUrl: (target: string) => string | null) {
  return ViewPlugin.fromClass(
    class EmbedPreviewPlugin {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(update: ViewUpdate) {
        // Rebuild decorations when document or viewport changes
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.build(update.view);
        }
      }

      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const doc = view.state.doc;

        // Iterate through visible lines only (viewport optimization)
        for (const { from, to } of view.visibleRanges) {
          const text = doc.sliceString(from, to);

          EMBED_PATTERN.lastIndex = 0;
          let match;

          while ((match = EMBED_PATTERN.exec(text)) !== null) {
            const target = match[1]!.trim();
            const url = getUrl(target);

            // Only add widget if URL is resolved
            if (url) {
              const matchStart = from + match.index;
              const matchEnd = matchStart + match[0].length;

              // Add widget decoration AFTER the embed syntax
              const widget = Decoration.widget({
                widget: new EmbedImageWidget(url, target),
                side: 1, // After the text
              });

              builder.add(matchEnd, matchEnd, widget);
            }
          }
        }

        return builder.finish();
      }
    },
    { decorations: v => v.decorations }
  );
}
