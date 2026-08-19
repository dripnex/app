import {
  Annotation,
  Facet,
  Prec,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import { Decoration, EditorView, WidgetType, keymap, type DecorationSet } from '@codemirror/view';
import type { NesMode } from './types';

export interface NesSuggestion {
  text: string;
  pos: number;
}

export interface NesCompleteInput {
  title: string;
  content: string;
  cursor: number;
}

export interface NesExtensionOptions {
  getMode: () => NesMode;
  getTitle: () => string;
  complete: (input: NesCompleteInput) => Promise<string | null>;
  idleMs?: number;
}

const setNesEffect = StateEffect.define<NesSuggestion | null>();
const nesAccepted = Annotation.define<boolean>();

export const nesOptionsFacet = Facet.define<NesExtensionOptions, NesExtensionOptions | null>({
  combine(values) {
    return values[0] ?? null;
  },
});

class NesGhostWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  eq(other: NesGhostWidget): boolean {
    return other.text === this.text;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-nes-ghost';
    span.textContent = this.text;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function decorationsFor(suggestion: NesSuggestion | null): DecorationSet {
  if (!suggestion?.text) return Decoration.none;
  return Decoration.set([
    Decoration.widget({
      widget: new NesGhostWidget(suggestion.text),
      side: 1,
    }).range(suggestion.pos),
  ]);
}

export const nesField = StateField.define<NesSuggestion | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setNesEffect)) return effect.value;
    }
    if (tr.docChanged || tr.selection) return null;
    return value;
  },
  provide: field => [
    EditorView.decorations.from(field, decorationsFor),
    EditorView.editorAttributes.from(field, value =>
      value ? { class: 'cm-nes-active' } : ({} as Record<string, string>)
    ),
  ],
});

export function hasNesSuggestion(view: EditorView): boolean {
  return view.state.field(nesField, false) != null;
}

export function dismissNes(view: EditorView): boolean {
  if (!hasNesSuggestion(view)) return false;
  view.dispatch({ effects: setNesEffect.of(null) });
  return true;
}

export function acceptNes(view: EditorView): boolean {
  const suggestion = view.state.field(nesField, false);
  if (!suggestion) return false;
  const pos = suggestion.pos;
  if (pos < 0 || pos > view.state.doc.length) {
    view.dispatch({ effects: setNesEffect.of(null) });
    return false;
  }
  view.dispatch({
    changes: { from: pos, insert: suggestion.text },
    selection: { anchor: pos + suggestion.text.length },
    effects: setNesEffect.of(null),
    annotations: nesAccepted.of(true),
    userEvent: 'input',
  });
  return true;
}

const generations = new WeakMap<EditorView, number>();

function nextGeneration(view: EditorView): number {
  const n = (generations.get(view) ?? 0) + 1;
  generations.set(view, n);
  return n;
}

export function triggerNes(view: EditorView): boolean {
  const options = view.state.facet(nesOptionsFacet);
  if (!options || options.getMode() === 'disabled') return false;
  void requestSuggestion(view, options);
  return true;
}

async function requestSuggestion(view: EditorView, options: NesExtensionOptions): Promise<void> {
  const cursor = view.state.selection.main.head;
  const generation = nextGeneration(view);
  const insertion = await options.complete({
    title: options.getTitle(),
    content: view.state.doc.toString(),
    cursor,
  });
  if (generations.get(view) !== generation) return;
  if (!view.dom.isConnected) return;
  if (!insertion || view.state.selection.main.head !== cursor) return;
  view.dispatch({
    effects: setNesEffect.of({ text: insertion, pos: cursor }),
  });
}

export function createNesExtension(options: NesExtensionOptions): Extension {
  const idleMs = options.idleMs ?? 500;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function clearIdle(): void {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  return [
    nesOptionsFacet.of(options),
    nesField,
    Prec.high(
      keymap.of([
        { key: 'Tab', run: acceptNes },
        { key: 'Escape', run: dismissNes },
      ])
    ),
    EditorView.updateListener.of(update => {
      if (!update.docChanged) return;
      if (update.transactions.some(tr => tr.annotation(nesAccepted))) return;
      clearIdle();
      if (options.getMode() !== 'automatic') return;
      const view = update.view;
      idleTimer = setTimeout(() => {
        idleTimer = null;
        if (options.getMode() !== 'automatic') return;
        if (!view.dom.isConnected) return;
        if (view.state.selection.main.empty) {
          void requestSuggestion(view, options);
        }
      }, idleMs);
    }),
    EditorView.domEventObservers({
      blur() {
        clearIdle();
      },
    }),
  ];
}

export function setNesSuggestion(view: EditorView, text: string, pos: number): void {
  view.dispatch({ effects: setNesEffect.of({ text, pos }) });
}
