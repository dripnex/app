import { useSyncExternalStore, useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
import {
  CommandRegistry,
  formatKeybinding as _formatKeybinding,
  type RegisteredCommand,
  type KeyBinding,
} from '@readied/command-registry';
import { editorCommands } from '@readied/command-registry/definitions';
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
} from '@readied/commands';

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
const editorExecutors: Record<string, (view: EditorView) => void> = {
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
  'editor:undo': undoChange,
  'editor:redo': redoChange,
};

for (const def of editorCommands) {
  const executor = editorExecutors[def.id];
  if (executor) {
    registry.register({
      ...def,
      execute: () => {
        const view = getEditorView();
        if (!view) return false;
        executor(view);
        return true;
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

/** Dispatch a command by id */
export function dispatchCommand(id: string): Promise<boolean> {
  return registry.dispatch(id);
}

/** Get effective keybinding for display */
export function getCommandKeybinding(id: string): KeyBinding | undefined {
  return registry.getKeybinding(id);
}
