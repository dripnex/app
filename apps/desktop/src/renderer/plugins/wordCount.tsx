import { useState, useEffect } from 'react';
import type { PluginManifest, EditorAPI, ZoneComponentProps } from '@readied/plugin-api';

interface WordCountState {
  words: number;
  chars: number;
  lines: number;
}

function WordCountStatus({ meta }: ZoneComponentProps) {
  const editor = meta?.editor as EditorAPI | undefined;
  const [stats, setStats] = useState<WordCountState>({ words: 0, chars: 0, lines: 0 });

  useEffect(() => {
    if (!editor) return;

    // Initial count
    const update = () => {
      setStats({
        words: editor.getWordCount(),
        chars: editor.getCharCount(),
        lines: editor.getLineCount(),
      });
    };

    update();

    // Subscribe to changes
    const unsubscribe = editor.onDocChanged(() => update());
    return unsubscribe;
  }, [editor]);

  if (!editor) return null;

  return (
    <>
      <span>{stats.words} words</span>
      <span>{stats.chars} chars</span>
      <span>{stats.lines} lines</span>
    </>
  );
}

export const wordCountPlugin: PluginManifest = {
  id: 'readied-word-count',
  name: 'Word Count',
  version: '1.0.0',
  description: 'Shows word, character, and line count in the editor status bar',

  activate(context) {
    let visible = true;

    const show = () => {
      context.layout.addComponent('editor-status-bar', {
        id: 'word-count:status',
        component: WordCountStatus,
        order: 10,
        meta: { editor: context.editor },
      });
    };

    const hide = () => {
      context.layout.removeComponent('word-count:status');
    };

    // Show by default
    show();

    // Register toggle command (appears in Command Palette under "Plugins")
    const unregisterCommand = context.registerCommand(
      {
        id: 'toggle-stats',
        name: 'Toggle Word Count',
        icon: 'Terminal',
      },
      () => {
        visible = !visible;
        if (visible) {
          show();
        } else {
          hide();
        }
        return true;
      },
    );

    return {
      dispose() {
        hide();
        unregisterCommand();
      },
    };
  },
};
