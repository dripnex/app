import { useState, useCallback, useMemo, type ReactElement } from 'react';
import {
  ViewPlugin,
  WidgetType,
  Decoration,
  type ViewUpdate,
  type DecorationSet,
  type EditorView,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { PluginManifest, ZoneComponentProps } from '@readied/plugin-api';
import React from 'react';

// ============================================================
// Shared: GFM Table Parser
// ============================================================

interface ParsedTable {
  headers: string[];
  alignments: Array<'left' | 'center' | 'right' | 'none'>;
  rows: string[][];
  from: number;
  to: number;
}

const TABLE_SEP_RE = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

function parseAlignment(cell: string): 'left' | 'center' | 'right' | 'none' {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(':');
  const right = trimmed.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return 'none';
}

function splitRow(line: string): string[] {
  // Remove leading/trailing pipe and split
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map(c => c.trim());
}

function parseGfmTable(text: string, from: number): ParsedTable | null {
  const lines = text.split('\n');
  const headerLine = lines[0];
  const sepLine = lines[1];
  if (!headerLine || !sepLine) return null;

  // Line 0 = headers, Line 1 = separator
  if (!TABLE_SEP_RE.test(sepLine)) return null;

  const headers = splitRow(headerLine);
  const sepCells = splitRow(sepLine);
  if (headers.length !== sepCells.length) return null;

  const alignments = sepCells.map(parseAlignment);
  const rows: string[][] = [];

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line) break;
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes('|')) break;
    const cells = splitRow(line);
    // Pad or truncate to header count
    while (cells.length < headers.length) cells.push('');
    rows.push(cells.slice(0, headers.length));
  }

  return { headers, alignments, rows, from, to: from + text.length };
}

interface TableRange {
  from: number;
  to: number;
  text: string;
}

function findTableRanges(docText: string): TableRange[] {
  const ranges: TableRange[] = [];
  const lines = docText.split('\n');
  let i = 0;

  while (i < lines.length) {
    const currentLine = lines[i]!;
    const nextLine = lines[i + 1];
    // Look for a header line followed by a separator
    if (nextLine !== undefined && currentLine.trim().includes('|') && TABLE_SEP_RE.test(nextLine)) {
      const startLine = i;
      i += 2; // Skip header + separator

      // Consume body rows
      while (i < lines.length && lines[i]!.trim().includes('|')) {
        i++;
      }

      // Calculate offsets
      let from = 0;
      for (let j = 0; j < startLine; j++) {
        from += lines[j]!.length + 1; // +1 for newline
      }
      let to = from;
      for (let j = startLine; j < i; j++) {
        to += lines[j]!.length + (j < i - 1 ? 1 : 0);
      }

      const text = lines.slice(startLine, i).join('\n');
      ranges.push({ from, to, text });
    } else {
      i++;
    }
  }

  return ranges;
}

function findTableAtCursor(content: string, pos: number): ParsedTable | null {
  const ranges = findTableRanges(content);
  for (const range of ranges) {
    if (pos >= range.from && pos <= range.to) {
      return parseGfmTable(range.text, range.from);
    }
  }
  return null;
}

function generateGfmTable(rows: number, cols: number): string {
  const header =
    '| ' + Array.from({ length: cols }, (_, i) => `Column ${i + 1}`).join(' | ') + ' |';
  const separator = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
  const bodyRow = '| ' + Array.from({ length: cols }, () => '  ').join(' | ') + ' |';
  const body = Array.from({ length: rows }, () => bodyRow).join('\n');
  return `${header}\n${separator}\n${body}`;
}

function tableToCsv(table: ParsedTable): string {
  const escapeCell = (cell: string): string => {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };

  const headerLine = table.headers.map(escapeCell).join(',');
  const bodyLines = table.rows.map(row => row.map(escapeCell).join(','));
  return [headerLine, ...bodyLines].join('\n');
}

// ============================================================
// Feature 1: Insert Table Modal (React component)
// ============================================================

interface InsertTableModalProps {
  meta?: Record<string, unknown>;
}

function InsertTableModal({ meta }: InsertTableModalProps) {
  const insertFn = meta?.insertTable as ((rows: number, cols: number) => void) | undefined;
  const closeFn = meta?.closeModal as (() => void) | undefined;
  const [hoverRow, setHoverRow] = useState(0);
  const [hoverCol, setHoverCol] = useState(0);

  const maxRows = 10;
  const maxCols = 6;

  const handleInsert = useCallback(
    (r: number, c: number) => {
      insertFn?.(r, c);
      closeFn?.();
    },
    [insertFn, closeFn]
  );

  return (
    <div className="insert-table-modal" onClick={e => e.stopPropagation()}>
      <div className="insert-table-modal-header">
        <span className="insert-table-modal-title">Insert Table</span>
        <span className="insert-table-modal-size">
          {hoverRow > 0 && hoverCol > 0 ? `${hoverRow} x ${hoverCol}` : 'Select size'}
        </span>
      </div>
      <div className="insert-table-modal-grid">
        {Array.from({ length: maxRows }, (_, r) => (
          <div key={r} className="insert-table-modal-row">
            {Array.from({ length: maxCols }, (_, c) => (
              <button
                key={c}
                className={`insert-table-modal-cell${
                  r + 1 <= hoverRow && c + 1 <= hoverCol ? ' active' : ''
                }`}
                onMouseEnter={() => {
                  setHoverRow(r + 1);
                  setHoverCol(c + 1);
                }}
                onClick={() => handleInsert(r + 1, c + 1)}
                aria-label={`${r + 1} rows, ${c + 1} columns`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Feature 2: WYSIWYG CM6 ViewPlugin
// ============================================================

class TableWidget extends WidgetType {
  constructor(
    private table: ParsedTable,
    private rawText: string
  ) {
    super();
  }

  eq(other: TableWidget): boolean {
    return this.rawText === other.rawText;
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-table-widget';

    const table = document.createElement('table');
    table.className = 'cm-table-visual';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (let i = 0; i < this.table.headers.length; i++) {
      const th = document.createElement('th');
      th.textContent = this.table.headers[i] ?? '';
      const align = this.table.alignments[i] ?? 'none';
      if (align !== 'none') th.style.textAlign = align;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    for (const row of this.table.rows) {
      const tr = document.createElement('tr');
      for (let i = 0; i < row.length; i++) {
        const td = document.createElement('td');
        td.textContent = row[i] ?? '';
        const align = this.table.alignments[i] ?? 'none';
        if (align !== 'none') td.style.textAlign = align;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function buildTableDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const docText = doc.toString();
  const ranges = findTableRanges(docText);
  const sel = view.state.selection.main;

  for (const range of ranges) {
    // Skip if cursor is inside this table range (show raw markdown for editing)
    if (sel.from >= range.from && sel.from <= range.to) continue;
    if (sel.to >= range.from && sel.to <= range.to) continue;

    // Only process tables in visible ranges
    let visible = false;
    for (const vr of view.visibleRanges) {
      if (range.from <= vr.to && range.to >= vr.from) {
        visible = true;
        break;
      }
    }
    if (!visible) continue;

    const parsed = parseGfmTable(range.text, range.from);
    if (!parsed) continue;

    const widget = new TableWidget(parsed, range.text);
    builder.add(range.from, range.to, Decoration.replace({ widget }));
  }

  return builder.finish();
}

const tableViewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildTableDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildTableDecorations(update.view);
      }
    }
  },
  {
    decorations: v => v.decorations,
  }
);

// ============================================================
// Feature 3: Sortable Preview Table (React component)
// ============================================================

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) {
    const el = node as ReactElement;
    return extractText(el.props.children);
  }
  return '';
}

function SortableTable(
  props: React.HTMLAttributes<HTMLTableElement> & { children?: React.ReactNode }
) {
  const { children, ...rest } = props;
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Extract thead and tbody from children
  const { thead, tbody, otherChildren } = useMemo(() => {
    let thead: ReactElement | null = null;
    let tbody: ReactElement | null = null;
    const otherChildren: React.ReactNode[] = [];

    React.Children.forEach(children, child => {
      if (!React.isValidElement(child)) {
        otherChildren.push(child);
        return;
      }
      const el = child as ReactElement;
      if (el.type === 'thead') thead = el;
      else if (el.type === 'tbody') tbody = el;
      else otherChildren.push(child);
    });

    return { thead, tbody, otherChildren };
  }, [children]);

  // Extract and sort body rows
  const sortedTbodyChildren = useMemo(() => {
    if (!tbody) return null;
    const rows: ReactElement[] = [];
    React.Children.forEach((tbody as ReactElement).props.children, child => {
      if (React.isValidElement(child)) rows.push(child as ReactElement);
    });

    if (sortCol === null) return rows;

    const sorted = [...rows].sort((a, b) => {
      const aCells: React.ReactNode[] = [];
      const bCells: React.ReactNode[] = [];
      React.Children.forEach(a.props.children, c => aCells.push(c));
      React.Children.forEach(b.props.children, c => bCells.push(c));

      const aText = extractText(aCells[sortCol] ?? '');
      const bText = extractText(bCells[sortCol] ?? '');

      // Try numeric comparison
      const aNum = parseFloat(aText);
      const bNum = parseFloat(bText);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // String comparison
      const cmp = aText.localeCompare(bText);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [tbody, sortCol, sortDir]);

  const handleHeaderClick = useCallback(
    (colIndex: number) => {
      if (sortCol === colIndex) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortCol(colIndex);
        setSortDir('asc');
      }
    },
    [sortCol]
  );

  // Render with modified thead (sort indicators) and sorted tbody
  return (
    <table {...rest} className="sortable-table">
      {thead && (
        <thead>
          {React.Children.map((thead as ReactElement).props.children, trChild => {
            if (!React.isValidElement(trChild)) return trChild;
            return React.cloneElement(
              trChild as ReactElement,
              {
                children: React.Children.map(
                  (trChild as ReactElement).props.children,
                  (thChild, colIdx) => {
                    if (!React.isValidElement(thChild)) return thChild;
                    const el = thChild as ReactElement;
                    const isSorted = sortCol === colIdx;
                    const arrow = isSorted ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';
                    return React.cloneElement(el, {
                      className: `sortable-th${isSorted ? ' sorted' : ''}`,
                      onClick: () => handleHeaderClick(colIdx),
                      style: {
                        ...(((el.props as Record<string, unknown>).style as object) ?? {}),
                        cursor: 'pointer',
                        userSelect: 'none' as const,
                      },
                      children: (
                        <>
                          {el.props.children}
                          {arrow && <span className="sort-indicator">{arrow}</span>}
                        </>
                      ),
                    } as Record<string, unknown>);
                  }
                ),
              } as Record<string, unknown>
            );
          })}
        </thead>
      )}
      {tbody && sortedTbodyChildren && <tbody>{sortedTbodyChildren}</tbody>}
      {otherChildren}
    </table>
  );
}

// ============================================================
// Feature 4: Export to CSV
// ============================================================

// (Integrated as a command in the plugin manifest below)

// ============================================================
// Plugin Manifest
// ============================================================

export const tablesPlugin: PluginManifest = {
  id: 'readied-tables',
  name: 'Tables',
  version: '1.0.0',
  description:
    'Insert Table wizard, WYSIWYG table rendering, sortable preview columns, and Export to CSV',

  activate(context) {
    let wysiwygEnabled = context.config.get<boolean>('wysiwygEnabled') ?? true;
    let unregisterWysiwyg: (() => void) | null = null;
    let modalVisible = false;

    // --- Feature 2: WYSIWYG toggle ---
    const enableWysiwyg = () => {
      if (unregisterWysiwyg) return;
      unregisterWysiwyg = context.registerExtensions('table-wysiwyg', [tableViewPlugin]);
      context.log.info('Table WYSIWYG enabled');
    };

    const disableWysiwyg = () => {
      if (!unregisterWysiwyg) return;
      unregisterWysiwyg();
      unregisterWysiwyg = null;
      context.log.info('Table WYSIWYG disabled');
    };

    if (wysiwygEnabled) {
      enableWysiwyg();
    }

    // --- Feature 1: Insert Table command + modal ---
    const insertTable = (rows: number, cols: number) => {
      const md = generateGfmTable(rows, cols);
      context.editor.insertAtCursor('\n' + md + '\n');
      context.editor.focus();
    };

    const closeModal = () => {
      modalVisible = false;
      context.layout.removeComponent('insert-table-modal');
    };

    const openModal = () => {
      if (modalVisible) {
        closeModal();
        return;
      }
      modalVisible = true;
      context.layout.addComponent('modal', {
        id: 'insert-table-modal',
        component: InsertTableModal as React.ComponentType<ZoneComponentProps>,
        order: 10,
        meta: { insertTable, closeModal },
      });
    };

    const unregisterInsertCommand = context.registerCommand(
      {
        id: 'insert-table',
        name: 'Insert Table',
        keybinding: { key: 't', modifiers: ['Mod', 'Alt'] },
        icon: 'Table',
      },
      () => {
        openModal();
        return true;
      }
    );

    // --- Feature 2 toggle command ---
    const unregisterWysiwygCommand = context.registerCommand(
      {
        id: 'toggle-wysiwyg',
        name: 'Toggle Table WYSIWYG',
        icon: 'Table',
      },
      () => {
        wysiwygEnabled = !wysiwygEnabled;
        context.config.set('wysiwygEnabled', wysiwygEnabled);
        if (wysiwygEnabled) {
          enableWysiwyg();
        } else {
          disableWysiwyg();
        }
        return true;
      }
    );

    // --- Feature 3: Sortable Preview ---
    const unregisterPreview = context.registerPreviewComponent(
      'sortable-table',
      'table',
      SortableTable
    );

    // --- Feature 4: Export to CSV ---
    const unregisterExportCommand = context.registerCommand(
      {
        id: 'export-csv',
        name: 'Export Table to CSV',
        icon: 'Download',
      },
      async () => {
        const content = context.editor.getContent();
        const sel = context.editor.getSelection();
        const table = findTableAtCursor(content, sel.from);

        if (!table) {
          context.log.warn('No table found at cursor position');
          return false;
        }

        const csv = tableToCsv(table);
        try {
          await navigator.clipboard.writeText(csv);
          context.log.info('Table copied to clipboard as CSV');
        } catch (err) {
          context.log.error('Failed to copy CSV to clipboard', err);
        }
        return true;
      }
    );

    return {
      dispose() {
        closeModal();
        disableWysiwyg();
        unregisterInsertCommand();
        unregisterWysiwygCommand();
        unregisterPreview();
        unregisterExportCommand();
      },
    };
  },
};
