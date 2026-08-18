import type { CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import {
  filterFenceLanguages,
  filterSlashItems,
  matchFenceLang,
  matchSlashLine,
} from '@dripnex/commands';

function isInsideFence(context: CompletionContext): boolean {
  const textBefore = context.state.doc.sliceString(0, context.pos);
  const fences = textBefore.match(/^```/gm) ?? [];
  return fences.length % 2 === 1;
}

export const slashCompletions: CompletionSource = (
  context: CompletionContext
): CompletionResult | null => {
  if (isInsideFence(context)) return null;

  const line = context.state.doc.lineAt(context.pos);
  const prefix = line.text.slice(0, context.pos - line.from);
  const match = matchSlashLine(prefix);
  if (!match) return null;

  const items = filterSlashItems(match.query);
  if (items.length === 0) return null;

  const from = line.from + match.fromCol;
  return {
    from,
    to: context.pos,
    filter: false,
    options: items.map(item => ({
      label: item.label,
      detail: item.detail,
      section: item.section,
      type: 'keyword' as const,
      apply: (view: EditorView, _completion: unknown, applyFrom: number, applyTo: number) => {
        view.dispatch({
          changes: { from: applyFrom, to: applyTo, insert: item.snippet },
          selection: { anchor: applyFrom + item.cursor },
        });
      },
    })),
  };
};

export const fenceLanguageCompletions: CompletionSource = (
  context: CompletionContext
): CompletionResult | null => {
  const line = context.state.doc.lineAt(context.pos);
  const prefix = line.text.slice(0, context.pos - line.from);
  const match = matchFenceLang(prefix);
  if (!match) return null;

  const langs = filterFenceLanguages(match.query);
  if (langs.length === 0) return null;

  return {
    from: line.from + match.fromCol,
    to: context.pos,
    filter: false,
    options: langs.map(lang => ({
      label: lang,
      type: 'keyword' as const,
      apply: lang,
    })),
  };
};
