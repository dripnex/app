import type { PluginManifest } from '@readied/plugin-api';

/**
 * Build YAML frontmatter for a single note export.
 */
function buildFrontmatter(note: { id?: string; title: string; tags?: string[] }): string {
  const escapedTitle = note.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const now = new Date().toISOString();
  const tagsYaml =
    note.tags && note.tags.length > 0 ? `tags: [${note.tags.join(', ')}]` : 'tags: []';

  const lines = ['---'];
  if (note.id) lines.push(`id: "${note.id}"`);
  lines.push(`title: "${escapedTitle}"`);
  lines.push(`exported: ${now}`);
  lines.push(tagsYaml);
  lines.push('---', '');

  return lines.join('\n');
}

/**
 * Convert GFM-flavored markdown table block to HTML <table>.
 */
function convertTable(block: string): string {
  const lines = block.trim().split('\n');
  if (lines.length < 2) return block;

  const parseRow = (row: string): string[] =>
    row
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(cell => cell.trim());

  const headerLine = lines[0] ?? '';
  const separatorLine = lines[1] ?? '';
  const headerCells = parseRow(headerLine);

  // Verify line 2 is a separator row (e.g. |---|---|)
  if (!/^[\s|:-]+$/.test(separatorLine)) return block;

  let html = '<table><thead><tr>';
  for (const cell of headerCells) {
    html += `<th>${cell}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (let i = 2; i < lines.length; i++) {
    const cells = parseRow(lines[i] ?? '');
    html += '<tr>';
    for (const cell of cells) {
      html += `<td>${cell}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

/**
 * Convert markdown content to HTML using regex patterns.
 * Handles: tables, blockquotes, ordered/unordered lists, images,
 * horizontal rules, code blocks, headers, bold, italic, links, inline code.
 */
function markdownToHtml(content: string): string {
  let html = content;

  // 1. Code blocks (must come first to protect contents)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // 2. Tables — find contiguous lines starting with |
  html = html.replace(
    /(?:^|\n)((?:\|[^\n]+\n){2,}(?:\|[^\n]+))/g,
    (_match, tableBlock: string) => '\n' + convertTable(tableBlock)
  );

  // 3. Horizontal rules (must come before headers to avoid `---` confusion)
  html = html.replace(/^(?:---|\*\*\*|___)$/gm, '<hr>');

  // 4. Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 5. Blockquotes (consecutive > lines grouped)
  html = html.replace(/^(?:>\s?(.+)\n?)+/gm, match => {
    const inner = match
      .split('\n')
      .map(line => line.replace(/^>\s?/, ''))
      .filter(Boolean)
      .join('<br>');
    return `<blockquote>${inner}</blockquote>`;
  });

  // 6. Images (must come before links: ![alt](url))
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // 7. Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 8. Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 9. Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 10. Ordered lists — wrap consecutive `1. ` lines
  html = html.replace(/(?:^\d+\.\s+.+$\n?)+/gm, match => {
    const items = match
      .trim()
      .split('\n')
      .map(line => `<li>${line.replace(/^\d+\.\s+/, '')}</li>`)
      .join('');
    return `<ol>${items}</ol>`;
  });

  // 11. Unordered lists — wrap consecutive `- ` or `* ` lines
  html = html.replace(/(?:^[-*]\s+.+$\n?)+/gm, match => {
    const items = match
      .trim()
      .split('\n')
      .map(line => `<li>${line.replace(/^[-*]\s+/, '')}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  });

  // 12. Paragraphs (wrap remaining non-tag lines)
  html = html.replace(/^(?!<[hliupcoatb]|<\/)((?!<\/)[^\n]+)$/gm, '<p>$1</p>');

  return html;
}

export const exportMarkdownPlugin: PluginManifest = {
  id: 'readied-export-markdown',
  name: 'Export Markdown',
  version: '1.1.0',
  description: 'Copy notes as Markdown or HTML, or export to file',

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
        void navigator.clipboard.writeText(content);
        context.log.info('Markdown copied to clipboard');
        return true;
      }
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

        const html = markdownToHtml(content);

        void navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([content], { type: 'text/plain' }),
          }),
        ]);
        context.log.info('HTML copied to clipboard');
        return true;
      }
    );

    const unregisterExportFile = context.registerCommand(
      {
        id: 'export-file',
        name: 'Export Note to File',
        icon: 'Download',
      },
      () => {
        const content = context.editor.getContent();
        if (!content) return false;

        const note = context.app.getCurrentNote();
        const title = note?.title ?? 'Untitled';

        // Build content with frontmatter if not already present
        let exportContent = content;
        if (!content.trimStart().startsWith('---')) {
          const frontmatter = buildFrontmatter({
            id: note?.id,
            title,
          });
          exportContent = frontmatter + content;
        }

        // Use IPC to show save dialog and write file
        void window.readied.data
          .exportNote(exportContent, title)
          .then(result => {
            if (result.success) {
              context.log.info(`Note exported to ${result.path}`);
            }
          })
          .catch(() => {
            context.log.error('Failed to export note');
          });

        return true;
      }
    );

    return {
      dispose() {
        unregisterCopyMd();
        unregisterCopyHtml();
        unregisterExportFile();
      },
    };
  },
};
