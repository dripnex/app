import type { PluginManifest } from '@dripnex/plugin-api';
import { buildPrintDocument, capturePreviewHtml } from './exportDocument';

/**
 * Escape a string for safe inclusion as a YAML double-quoted scalar.
 */
function escapeYamlScalar(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Escape HTML special characters to prevent injection in table cells.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build YAML frontmatter for a single note export.
 */
function buildFrontmatter(note: { id?: string; title: string; tags?: string[] }): string {
  const escapedTitle = escapeYamlScalar(note.title);
  const now = new Date().toISOString();
  const tagsYaml =
    note.tags && note.tags.length > 0
      ? `tags: [${note.tags.map(t => `"${escapeYamlScalar(t)}"`).join(', ')}]`
      : 'tags: []';

  const lines = ['---'];
  if (note.id) lines.push(`id: "${escapeYamlScalar(note.id)}"`);
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
    html += `<th>${escapeHtml(cell)}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (let i = 2; i < lines.length; i++) {
    const cells = parseRow(lines[i] ?? '');
    html += '<tr>';
    for (const cell of cells) {
      html += `<td>${escapeHtml(cell)}</td>`;
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

function currentExportHtml(fallbackMarkdown: string, title: string): string {
  const preview = capturePreviewHtml();
  const body = preview && preview.trim() ? preview : markdownToHtml(fallbackMarkdown);
  return buildPrintDocument(title, body);
}

export const exportMarkdownPlugin: PluginManifest = {
  id: 'dripnex-export-markdown',
  name: 'Export Markdown',
  version: '1.2.0',
  description: 'Copy or export notes as Markdown, HTML, or PDF, and print',

  activate(context) {
    const unregisterCopyMd = context.registerCommand(
      {
        id: 'copy-markdown',
        name: 'Copy as Markdown',
        keybinding: { key: 'C', modifiers: ['Mod', 'Shift'] },
        icon: 'Copy',
      },
      async () => {
        const content = context.editor.getContent();
        if (!content) return false;
        await navigator.clipboard.writeText(content);
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
      async () => {
        const content = context.editor.getContent();
        if (!content) return false;

        const html = markdownToHtml(content);

        await navigator.clipboard.write([
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
        name: 'Export as Markdown',
        icon: 'Download',
      },
      () => {
        const content = context.editor.getContent();
        if (!content) return false;

        const note = context.app.getCurrentNote();
        const title = note?.title ?? 'Untitled';

        let exportContent = content;
        if (!content.trimStart().startsWith('---')) {
          const frontmatter = buildFrontmatter({
            id: note?.id,
            title,
          });
          exportContent = frontmatter + content;
        }

        void window.dripnex.data
          .exportFile(exportContent, title, 'md')
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

    const unregisterExportHtml = context.registerCommand(
      {
        id: 'export-html',
        name: 'Export as HTML',
        icon: 'FileCode',
      },
      () => {
        const content = context.editor.getContent();
        if (!content) return false;
        const title = context.app.getCurrentNote()?.title ?? 'Untitled';
        const html = currentExportHtml(content, title);
        void window.dripnex.data
          .exportFile(html, title, 'html')
          .then(result => {
            if (result.success) context.log.info(`HTML exported to ${result.path}`);
          })
          .catch(() => context.log.error('Failed to export HTML'));
        return true;
      }
    );

    const unregisterExportPdf = context.registerCommand(
      {
        id: 'export-pdf',
        name: 'Export as PDF',
        icon: 'FileText',
      },
      () => {
        const content = context.editor.getContent();
        if (!content) return false;
        const title = context.app.getCurrentNote()?.title ?? 'Untitled';
        const html = currentExportHtml(content, title);
        void window.dripnex.data
          .exportFile(html, title, 'pdf')
          .then(result => {
            if (result.success) context.log.info(`PDF exported to ${result.path}`);
          })
          .catch(() => context.log.error('Failed to export PDF'));
        return true;
      }
    );

    const unregisterPrint = context.registerCommand(
      {
        id: 'print',
        name: 'Print Note',
        icon: 'Printer',
      },
      () => {
        const content = context.editor.getContent();
        if (!content) return false;
        const title = context.app.getCurrentNote()?.title ?? 'Untitled';
        const html = currentExportHtml(content, title);
        void window.dripnex.data.printHtml(html).catch(() => {
          context.log.error('Print failed');
        });
        return true;
      }
    );

    return {
      dispose() {
        unregisterCopyMd();
        unregisterCopyHtml();
        unregisterExportFile();
        unregisterExportHtml();
        unregisterExportPdf();
        unregisterPrint();
      },
    };
  },
};
