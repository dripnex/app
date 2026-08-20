import type { PluginManifest } from '@dripnex/plugin-api';
import { wrapSelectionWithUrl } from '@dripnex/commands';

export function wrapSelectionAsLink(
  content: string,
  from: number,
  to: number,
  rawUrl: string
): { from: number; to: number; text: string } | null {
  const url = rawUrl.trim();
  if (!url) return null;
  return { from, to, text: wrapSelectionWithUrl(content.slice(from, to), url) };
}

export const pasteAsLinkPlugin: PluginManifest = {
  id: 'dripnex-paste-as-link',
  name: 'Paste as Link',
  version: '1.0.0',
  description: 'Wrap the selection as a Markdown link using the clipboard URL',

  activate(context) {
    const paste = async () => {
      const { from, to } = context.editor.getSelection();
      const next = wrapSelectionAsLink(
        context.editor.getContent(),
        from,
        to,
        await context.clipboard.readText()
      );
      if (!next) {
        context.log.warn('Clipboard has no URL to paste as a link');
        return false;
      }
      context.editor.replaceRange(next.from, next.to, next.text);
      return true;
    };

    const removeMenu = context.menu.add({
      label: 'Paste as Link',
      accelerator: 'Mod+Shift+K',
      click: () => void paste(),
    });

    return {
      dispose() {
        removeMenu();
      },
    };
  },
};
