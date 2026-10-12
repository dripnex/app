import type { PluginManifest } from '@dripnex/plugin-api';

export function journalStamp(date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `\n\n## ${hh}:${mm}\n\n`;
}

export const journalPlugin: PluginManifest = {
  id: 'dripnex-journal',
  name: 'Journal',
  version: '1.0.0',
  description: 'Append a timestamped heading to the current note',

  activate(context) {
    const stamp = () => {
      const content = context.editor.getContent();
      const block = journalStamp();
      context.editor.replaceRange(content.length, content.length, block);
      context.editor.setSelection(content.length + block.length);
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'stamp', name: 'Insert Journal Stamp', icon: 'Clock' },
      stamp
    );

    return {
      dispose() {
        unregister();
      },
    };
  },
};
