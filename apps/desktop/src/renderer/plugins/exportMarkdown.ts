import type { PluginManifest } from '@readied/plugin-api';

export const exportMarkdownPlugin: PluginManifest = {
  id: 'readied-export-markdown',
  name: 'Export Markdown',
  version: '1.0.0',
  description:
    'Copy your notes as raw Markdown or rendered HTML to the clipboard',

  activate(context) {
    const unregisterCopyMd = context.registerCommand(
      {
        id: 'copy-markdown',
        name: 'Copy as Markdown',
        keybinding: { key: 'C', modifiers: ['Mod', 'Shift'] },
        icon: 'Copy',
      },
      () => {
        const content = context.editor.getContent();
        if (!content) return false;
        navigator.clipboard.writeText(content);
        context.log.info('Markdown copied to clipboard');
        return true;
      },
    );

    const unregisterCopyHtml = context.registerCommand(
      {
        id: 'copy-html',
        name: 'Copy as HTML',
        icon: 'Code',
      },
      () => {
        const content = context.editor.getContent();
        if (!content) return false;

        // Basic markdown-to-HTML conversion for clipboard
        let html = content
          // Code blocks (must come before inline code)
          .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
          // Headers
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          // Bold and italic
          .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          // Inline code
          .replace(/`([^`]+)`/g, '<code>$1</code>')
          // Links
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
          // Unordered lists
          .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
          // Paragraphs (wrap remaining lines)
          .replace(/^(?!<[hliupca])((?!<\/)[^\n]+)$/gm, '<p>$1</p>');

        navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([content], { type: 'text/plain' }),
          }),
        ]);
        context.log.info('HTML copied to clipboard');
        return true;
      },
    );

    return {
      dispose() {
        unregisterCopyMd();
        unregisterCopyHtml();
      },
    };
  },
};
