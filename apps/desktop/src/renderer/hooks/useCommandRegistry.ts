import { useSyncExternalStore, useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
import {
  CommandRegistry,
  formatKeybinding as _formatKeybinding,
  type RegisteredCommand,
  type KeyBinding,
} from '@dripnex/command-registry';
import { editorCommands } from '@dripnex/command-registry/definitions';
import {
  openSearchPanel,
  findNext,
  findPrevious,
  selectNextOccurrence,
  selectSelectionMatches,
} from '@codemirror/search';
import { toggleFold, foldAll, unfoldAll } from '@codemirror/language';
import {
  copyLineUp,
  copyLineDown,
  moveLineUp,
  moveLineDown,
  insertBlankLine,
  selectLine,
  cursorMatchingBracket,
  selectMatchingBracket,
  selectParentSyntax,
  cursorSubwordBackward,
  cursorSubwordForward,
  selectSubwordBackward,
  selectSubwordForward,
  toggleComment,
  toggleLineComment,
} from '@codemirror/commands';
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleInlineCode,
  insertLink,
  insertHeading,
  insertUnorderedList,
  insertOrderedList,
  insertCheckbox,
  insertQuote,
  insertCodeBlock,
  insertHorizontalRule,
  undoChange,
  redoChange,
  joinLines,
  sortLines,
  reverseSortLines,
  sortLinesInsensitive,
  reverseSortLinesInsensitive,
  insertLineBefore,
  upcaseAtCursor,
  downcaseAtCursor,
  findUnder,
  findUnderPrevious,
  skipAndSelectNextOccurrence,
  splitSelectionByLine,
  scrollLineUp,
  scrollLineDown,
  showInCenter,
} from '@dripnex/commands';
import { followWikilinkAtCursor } from '../utils/followWikilinkAtCursor';
import { acceptNes, dismissNes, triggerNes } from '../editor/nes/extension';

function openInlineAi(): boolean {
  window.dispatchEvent(new Event('dripnex:ai:open-inline'));
  return true;
}

// --- Singleton registry ---
export const registry = new CommandRegistry();

// --- Mutable EditorView slot ---
let editorView: EditorView | null = null;

export function setEditorView(view: EditorView | null): void {
  editorView = view;
}

export function getEditorView(): EditorView | null {
  return editorView;
}

// --- Register editor commands with execute implementations ---
const editorExecutors: Record<string, (view: EditorView) => boolean | void> = {
  'editor:follow-link': followWikilinkAtCursor,
  'editor:toggle-bold': toggleBold,
  'editor:toggle-italic': toggleItalic,
  'editor:toggle-strikethrough': toggleStrikethrough,
  'editor:toggle-inline-code': toggleInlineCode,
  'editor:insert-link': insertLink,
  'editor:insert-heading': view => insertHeading(view, 2),
  'editor:insert-unordered-list': insertUnorderedList,
  'editor:insert-ordered-list': insertOrderedList,
  'editor:insert-checkbox': insertCheckbox,
  'editor:insert-quote': insertQuote,
  'editor:insert-code-block': insertCodeBlock,
  'editor:insert-horizontal-rule': insertHorizontalRule,
  'editor:find': view => {
    openSearchPanel(view);
  },
  'editor:find-next': view => {
    findNext(view);
  },
  'editor:find-previous': view => {
    findPrevious(view);
  },
  'editor:toggle-fold': view => {
    toggleFold(view);
  },
  'editor:fold-all': view => {
    foldAll(view);
  },
  'editor:unfold-all': view => {
    unfoldAll(view);
  },
  'editor:undo': undoChange,
  'editor:redo': redoChange,
  'editor:edit-with-ai': () => openInlineAi(),
  'editor:trigger-nes': triggerNes,
  'editor:accept-nes': acceptNes,
  'editor:dismiss-nes': dismissNes,
  'editor:copy-line-up': copyLineUp,
  'editor:copy-line-down': copyLineDown,
  'editor:move-line-up': moveLineUp,
  'editor:move-line-down': moveLineDown,
  'editor:insert-blank-line': insertBlankLine,
  'editor:insert-line-before': insertLineBefore,
  'editor:select-line': selectLine,
  'editor:go-matching-bracket': cursorMatchingBracket,
  'editor:select-matching-bracket': selectMatchingBracket,
  'editor:select-parent-syntax': selectParentSyntax,
  'editor:go-subword-left': cursorSubwordBackward,
  'editor:go-subword-right': cursorSubwordForward,
  'editor:select-subword-left': selectSubwordBackward,
  'editor:select-subword-right': selectSubwordForward,
  'editor:select-next-occurrence': selectNextOccurrence,
  'editor:select-selection-matches': selectSelectionMatches,
  'editor:toggle-comment': toggleComment,
  'editor:toggle-line-comment': toggleLineComment,
  'editor:sort-lines-insensitive': sortLinesInsensitive,
  'editor:reverse-sort-lines-insensitive': reverseSortLinesInsensitive,
  'editor:sort-lines': sortLines,
  'editor:reverse-sort-lines': reverseSortLines,
  'editor:join-lines': joinLines,
  'editor:upcase-at-cursor': upcaseAtCursor,
  'editor:downcase-at-cursor': downcaseAtCursor,
  'editor:find-under': findUnder,
  'editor:find-under-previous': findUnderPrevious,
  'editor:skip-and-select-next-occurrence': skipAndSelectNextOccurrence,
  'editor:split-selection-by-line': splitSelectionByLine,
  'editor:scroll-line-up': scrollLineUp,
  'editor:scroll-line-down': scrollLineDown,
  'editor:show-in-center': showInCenter,
};

for (const def of editorCommands) {
  const executor = editorExecutors[def.id];
  if (executor) {
    registry.register({
      ...def,
      execute: () => {
        const view = getEditorView();
        if (!view) return false;
        return executor(view) !== false;
      },
    });
  }
}

// --- React hook ---
const emptySnapshot: RegisteredCommand[] = [];

export function useCommandRegistry(): RegisteredCommand[] {
  const subscribe = useCallback((listener: () => void) => registry.subscribe(listener), []);
  const getSnapshot = useCallback((): RegisteredCommand[] => {
    const all = registry.getAll();
    return all.length > 0 ? all : emptySnapshot;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export { _formatKeybinding as formatKeybinding };

/** Dispatch a command by id, optionally with a payload. */
export function dispatchCommand(id: string, payload?: Record<string, unknown>): Promise<boolean> {
  return registry.dispatch(id, payload);
}

/** Get effective keybinding for display */
export function getCommandKeybinding(id: string): KeyBinding | undefined {
  return registry.getKeybinding(id);
}
