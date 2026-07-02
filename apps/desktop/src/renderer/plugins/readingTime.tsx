import { useState, useEffect } from 'react';
import type { PluginManifest } from '@dripnex/plugin-api';
import type { EditorAPI, ZoneComponentProps } from '@dripnex/plugin-api';

const WORDS_PER_MINUTE = 200;

function ReadingTimeStatus({ meta }: ZoneComponentProps) {
  const editor = meta?.editor as EditorAPI | undefined;
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const words = editor.getWordCount();
      setMinutes(Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)));
    };

    update();
    const unsubscribe = editor.onDocChanged(() => update());
    return unsubscribe;
  }, [editor]);

  if (!editor) return null;

  return <span>{minutes} min read</span>;
}

export const readingTimePlugin: PluginManifest = {
  id: 'dripnex-reading-time',
  name: 'Reading Time',
  version: '1.0.0',
  description:
    'Shows estimated reading time in the editor status bar based on ~200 words per minute',

  activate(context) {
    let visible = true;

    const show = () => {
      context.layout.addComponent('editor-status-bar', {
        id: 'reading-time:status',
        component: ReadingTimeStatus,
        order: 20,
        meta: { editor: context.editor },
      });
    };

    const hide = () => {
      context.layout.removeComponent('reading-time:status');
    };

    show();

    const unregisterCommand = context.registerCommand(
      {
        id: 'toggle',
        name: 'Toggle Reading Time',
        icon: 'Clock',
      },
      () => {
        visible = !visible;
        if (visible) show();
        else hide();
        return true;
      }
    );

    return {
      dispose() {
        hide();
        unregisterCommand();
      },
    };
  },
};
