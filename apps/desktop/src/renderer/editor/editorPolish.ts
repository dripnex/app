/**
 * Source-mode chrome: strike checked tasks, URL tooltips, fence copy.
 */

import { RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  hoverTooltip,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { checkedTaskMarks, fenceAt, markdownLinkAt } from '@dripnex/commands';

const taskMark = Decoration.mark({ class: 'cm-task-checked' });

function taskDecorations(doc: string): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const mark of checkedTaskMarks(doc)) {
    if (mark.to > mark.from) builder.add(mark.from, mark.to, taskMark);
  }
  return builder.finish();
}

export const checkedTaskStrike = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = taskDecorations(view.state.doc.toString());
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = taskDecorations(update.state.doc.toString());
      }
    }
  },
  { decorations: plugin => plugin.decorations }
);

export const markdownLinkTooltip = hoverTooltip(
  (view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const hit = markdownLinkAt(line.text, pos - line.from);
    if (!hit) return null;
    return {
      pos: line.from + hit.from,
      end: line.from + hit.to,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.className = 'cm-md-link-tooltip';
        dom.textContent = hit.url;
        return { dom };
      },
    };
  },
  { hoverTime: 400 }
);

export function fenceCopyExtension(
  copy: (text: string) => void | Promise<void> = text => navigator.clipboard.writeText(text)
) {
  return ViewPlugin.fromClass(
    class {
      button: HTMLButtonElement;
      label = 'Copy';

      constructor(readonly view: EditorView) {
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'cm-fence-copy';
        this.button.textContent = this.label;
        this.button.setAttribute('aria-label', 'Copy code block');
        this.button.addEventListener('mousedown', event => event.preventDefault());
        this.button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          const fence = fenceAt(
            this.view.state.doc.toString(),
            this.view.state.selection.main.head
          );
          if (!fence) return;
          void Promise.resolve(copy(fence.body)).then(() => {
            this.button.textContent = 'Copied';
            window.setTimeout(() => {
              this.button.textContent = this.label;
            }, 1200);
          });
        });
        this.button.hidden = true;
        this.view.scrollDOM.appendChild(this.button);
        this.sync();
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          update.geometryChanged
        ) {
          this.sync();
        }
      }

      sync() {
        const fence = fenceAt(this.view.state.doc.toString(), this.view.state.selection.main.head);
        if (!fence) {
          this.button.hidden = true;
          return;
        }
        const from = Math.max(fence.openFrom, this.view.viewport.from);
        const coords = this.view.coordsAtPos(from);
        const scroller = this.view.scrollDOM.getBoundingClientRect();
        if (!coords || coords.top > scroller.bottom - 24) {
          this.button.hidden = true;
          return;
        }
        const top = Math.max(4, coords.top - scroller.top) + this.view.scrollDOM.scrollTop;
        this.button.hidden = false;
        this.button.style.top = `${top}px`;
      }

      destroy() {
        this.button.remove();
      }
    }
  );
}

export const editorPolishExtensions = [
  checkedTaskStrike,
  markdownLinkTooltip,
  fenceCopyExtension(),
];
