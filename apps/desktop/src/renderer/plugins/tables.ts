import type { PluginManifest } from '@readied/plugin-api';

/**
 * Tables — built-in plugin
 *
 * Registers an "Insert Table" command in the command palette
 * that inserts a markdown table template at the cursor position.
 * Tables render in preview via remarkGfm (already active).
 */
export const tablesPlugin: PluginManifest = {
  id: 'readied-tables',
  name: 'Tables',
  version: '1.0.0',
  description: 'Insert markdown tables with a command. Tables render in preview via GFM.',

  activate(context) {
    const unregisterInsert = context.registerCommand(
      {
        id: 'insert-table',
        name: 'Insert Table',
        keybinding: { key: 'T', modifiers: ['Mod', 'Shift'] },
        icon: 'Table',
      },
      () => {
        const template = [
          '| Column 1 | Column 2 | Column 3 |',
          '| -------- | -------- | -------- |',
          '| Cell 1   | Cell 2   | Cell 3   |',
          '| Cell 4   | Cell 5   | Cell 6   |',
          '',
        ].join('\n');
        context.editor.insertAtCursor(template);
        context.editor.focus();
        return true;
      }
    );

    return {
      dispose() {
        unregisterInsert();
      },
    };
  },
};
