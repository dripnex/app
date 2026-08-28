import { useEffect, useState } from 'react';
import { scanMarkdown } from '@dripnex/markdown';
import type { PluginManifest, EditorAPI, ZoneComponentProps } from '@dripnex/plugin-api';

export function taskStatsLabel(completed: number, total: number): string | null {
  if (total <= 0) return null;
  return `${completed}/${total} tasks`;
}

function TaskStatus({ meta }: ZoneComponentProps) {
  const editor = meta?.editor as EditorAPI | undefined;
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const tasks = scanMarkdown(editor.getContent()).tasks;
      setLabel(taskStatsLabel(tasks.completed, tasks.total));
    };
    update();
    return editor.onDocChanged(() => update());
  }, [editor]);

  if (!label) return null;
  return <span>{label}</span>;
}

export const noteStatsPlugin: PluginManifest = {
  id: 'dripnex-note-stats',
  name: 'Note Stats',
  version: '1.0.0',
  description: 'Shows open GFM tasks in the editor status bar',

  activate(context) {
    context.layout.addComponent('editor-status-bar', {
      id: 'note-stats:tasks',
      component: TaskStatus,
      order: 15,
      meta: { editor: context.editor },
    });
    return {
      dispose() {
        context.layout.removeComponent('note-stats:tasks');
      },
    };
  },
};
