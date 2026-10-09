import type { PluginManifest } from '@dripnex/plugin-api';

/** Clipboard mark for the current note. Does not rewrite the note. */
export function wikilinkFromTitle(title: string | null | undefined): string | null {
  const inner = (title ?? '').trim();
  if (!inner) return null;
  if (inner.includes('[[') || inner.includes(']]')) return null;
  return `[[${inner}]]`;
}

export const copyNotePlugin: PluginManifest = {
  id: 'dripnex-copy-note',
  name: 'Copy Note',
  version: '1.0.0',
  description: 'Copy the current note markdown or its wikilink to the clipboard',

  activate(context) {
    const copy = async () => {
      const content = context.editor.getContent();
      if (!content.trim()) {
        context.notifications.addWarning('Nothing to copy');
        return false;
      }
      try {
        await context.clipboard.writeText(content);
      } catch {
        context.notifications.addError('Could not copy markdown');
        return false;
      }
      context.notifications.addSuccess('Copied markdown');
      return true;
    };

    const copyWikilink = async () => {
      const mark = wikilinkFromTitle(context.app.getCurrentNote()?.title);
      if (!mark) {
        context.notifications.addWarning('This note has no title');
        return false;
      }
      try {
        await context.clipboard.writeText(mark);
      } catch {
        context.notifications.addError('Could not copy wikilink');
        return false;
      }
      context.notifications.addSuccess(`Copied ${mark}`);
      return true;
    };

    const unregister = context.registerCommand(
      { id: 'copy', name: 'Copy Note Markdown', icon: 'Copy' },
      () => void copy()
    );
    const unregisterWikilink = context.registerCommand(
      { id: 'copy-wikilink', name: 'Copy as Wikilink', icon: 'Link' },
      () => void copyWikilink()
    );

    return {
      dispose() {
        unregister();
        unregisterWikilink();
      },
    };
  },
};
