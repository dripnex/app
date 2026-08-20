import { useState, useCallback, useMemo, type ReactElement } from 'react';
import { WidgetType, Decoration, EditorView, keymap, type DecorationSet } from '@codemirror/view';
import { EditorSelection, RangeSetBuilder, StateField, type EditorState } from '@codemirror/state';
import type { PluginManifest, ZoneComponentProps } from '@dripnex/plugin-api';
import {
  applyTableOp,
  findTableAtCursor,
  findTableRanges,
  formatAllTables,
  generateGfmTable,
  parseGfmTable,
  tableToCsv,
  type ParsedTable,
  type TableOp,
} from '@dripnex/tables';
import React from 'react';
import { cssm } from '../lib/cssm';
import tableStyles from './tables.module.css';

export { findTableRanges, findTableAtCursor, parseGfmTable, generateGfmTable, tableToCsv };

const sc = cssm(tableStyles);

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
    <div className={sc('insert-table-modal')} onClick={e => e.stopPropagation()}>
      <div className={sc('insert-table-modal-header')}>
        <span className={sc('insert-table-modal-title')}>Insert Table</span>
        <span className={sc('insert-table-modal-size')}>
          {hoverRow > 0 && hoverCol > 0 ? `${hoverRow} x ${hoverCol}` : 'Select size'}
        </span>
      </div>
      <div className={sc('insert-table-modal-grid')}>
        {Array.from({ length: maxRows }, (_, r) => (
          <div key={r} className={sc('insert-table-modal-row')}>
            {Array.from({ length: maxCols }, (_, c) => (
              <button
                key={c}
                className={sc(
                  'insert-table-modal-cell',
                  r + 1 <= hoverRow && c + 1 <= hoverCol && 'active'
                )}
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

// Build table decorations from EditorState (StateField-compatible).
// We MUST use StateField, not ViewPlugin: tables span multiple lines, and
// CodeMirror forbids Decoration.replace() ranges that include line breaks
// when provided by a ViewPlugin. See dev.to/marijn — "Decorations that
// replace line breaks may not be specified via plugins".
function buildTableDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc;
  const docText = doc.toString();
  const ranges = findTableRanges(docText);
  const sel = state.selection.main;

  for (const range of ranges) {
    const cursorInside =
      (sel.from >= range.from && sel.from <= range.to) ||
      (sel.to >= range.from && sel.to <= range.to);

    if (cursorInside) {
      // Line marks only — adding these AND a replace at range.from is
      // illegal (replace.from < later line.from).
      const startLine = doc.lineAt(range.from);
      const endLine = doc.lineAt(Math.max(range.from, range.to - 1));
      for (let n = startLine.number; n <= endLine.number; n++) {
        const line = doc.line(n);
        builder.add(line.from, line.from, Decoration.line({ class: 'cm-table-range' }));
      }
      continue;
    }

    const parsed = parseGfmTable(range.text, range.from);
    if (!parsed) continue;

    const widget = new TableWidget(parsed, range.text);
    builder.add(range.from, range.to, Decoration.replace({ widget }));
  }

  return builder.finish();
}

const tableDecorationsField = StateField.define<DecorationSet>({
  create(state) {
    return buildTableDecorations(state);
  },
  update(decorations, tr) {
    if (tr.docChanged || tr.selection) {
      return buildTableDecorations(tr.state);
    }
    return decorations.map(tr.changes);
  },
  provide: f => EditorView.decorations.from(f),
});

// ============================================================
// Feature 3: Sortable Preview Table (React component)
// ============================================================

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) {
    const el = node as ReactElement<{ children?: React.ReactNode; style?: React.CSSProperties }>;
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
    React.Children.forEach(
      (tbody as ReactElement<{ children?: React.ReactNode }>).props.children,
      child => {
        if (React.isValidElement(child)) rows.push(child as ReactElement);
      }
    );

    if (sortCol === null) return rows;

    const sorted = [...rows].sort((a, b) => {
      const aCells: React.ReactNode[] = [];
      const bCells: React.ReactNode[] = [];
      React.Children.forEach(
        (a as ReactElement<{ children?: React.ReactNode }>).props.children,
        c => aCells.push(c)
      );
      React.Children.forEach(
        (b as ReactElement<{ children?: React.ReactNode }>).props.children,
        c => bCells.push(c)
      );

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
    <div className={sc('sortable-table-wrap')}>
      <table {...rest} className={sc('sortable-table')}>
        {thead && (
          <thead>
            {React.Children.map(
              (thead as ReactElement<{ children?: React.ReactNode }>).props.children,
              trChild => {
                if (!React.isValidElement(trChild)) return trChild;
                const trEl = trChild as ReactElement<{
                  children?: React.ReactNode;
                  style?: React.CSSProperties;
                }>;
                return React.cloneElement(trEl, {
                  children: React.Children.map(
                    (trChild as ReactElement<{ children?: React.ReactNode }>).props.children,
                    (thChild, colIdx) => {
                      if (!React.isValidElement(thChild)) return thChild;
                      const el = thChild as ReactElement<{
                        children?: React.ReactNode;
                        style?: React.CSSProperties;
                        className?: string;
                      }>;
                      const isSorted = sortCol === colIdx;
                      const arrow = isSorted ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';
                      return React.cloneElement(el, {
                        className: sc('sortable-th', isSorted && 'sorted'),
                        onClick: () => handleHeaderClick(colIdx),
                        style: {
                          ...(el.props.style ?? {}),
                          cursor: 'pointer',
                          userSelect: 'none' as const,
                        },
                        children: (
                          <>
                            {el.props.children}
                            {arrow && <span className={sc('sort-indicator')}>{arrow}</span>}
                          </>
                        ),
                      } as Record<string, unknown>);
                    }
                  ),
                } as Record<string, unknown>);
              }
            )}
          </thead>
        )}
        {tbody && sortedTbodyChildren && <tbody>{sortedTbodyChildren}</tbody>}
        {otherChildren}
      </table>
    </div>
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
  id: 'dripnex-tables',
  name: 'Tables',
  version: '1.0.0',
  description: 'GFM tables: insert, WYSIWYG, Tab between cells, format, CSV export',

  activate(context) {
    let wysiwygEnabled = context.config.get<boolean>('wysiwygEnabled') ?? true;
    let unregisterWysiwyg: (() => void) | null = null;
    let modalVisible = false;

    // --- Feature 2: WYSIWYG toggle ---
    const enableWysiwyg = () => {
      if (unregisterWysiwyg) return;
      unregisterWysiwyg = context.registerExtensions('table-wysiwyg', [tableDecorationsField]);
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
    const applyOp = (op: TableOp): boolean => {
      const content = context.editor.getContent();
      const sel = context.editor.getSelection();
      const edit = applyTableOp(content, sel.from, op);
      if (!edit) return false;
      context.editor.replaceRange(edit.from, edit.to, edit.text);
      context.editor.setSelection(edit.cursorFrom, edit.cursorTo);
      context.editor.focus();
      return true;
    };

    const tableKeymap = keymap.of([
      {
        key: 'Tab',
        run: view => {
          const edit = applyTableOp(view.state.doc.toString(), view.state.selection.main.head, {
            type: 'nextCell',
          });
          if (!edit) return false;
          view.dispatch({
            changes: { from: edit.from, to: edit.to, insert: edit.text },
            selection:
              edit.cursorFrom === edit.cursorTo
                ? EditorSelection.cursor(edit.cursorFrom)
                : EditorSelection.range(edit.cursorFrom, edit.cursorTo),
          });
          return true;
        },
      },
      {
        key: 'Shift-Tab',
        run: view => {
          const edit = applyTableOp(view.state.doc.toString(), view.state.selection.main.head, {
            type: 'prevCell',
          });
          if (!edit) return false;
          view.dispatch({
            changes: { from: edit.from, to: edit.to, insert: edit.text },
            selection:
              edit.cursorFrom === edit.cursorTo
                ? EditorSelection.cursor(edit.cursorFrom)
                : EditorSelection.range(edit.cursorFrom, edit.cursorTo),
          });
          return true;
        },
      },
    ]);

    const unregisterTableKeys = context.registerExtensions('table-editor-keys', [tableKeymap]);

    const tableCommands: Array<{ id: string; name: string; op: TableOp }> = [
      { id: 'next-cell', name: 'Table: Next Cell', op: { type: 'nextCell' } },
      { id: 'prev-cell', name: 'Table: Previous Cell', op: { type: 'prevCell' } },
      { id: 'next-row', name: 'Table: Next Row', op: { type: 'nextRow' } },
      { id: 'move-left', name: 'Table: Move Left', op: { type: 'move', dRow: 0, dCol: -1 } },
      { id: 'move-right', name: 'Table: Move Right', op: { type: 'move', dRow: 0, dCol: 1 } },
      { id: 'move-up', name: 'Table: Move Up', op: { type: 'move', dRow: -1, dCol: 0 } },
      { id: 'move-down', name: 'Table: Move Down', op: { type: 'move', dRow: 1, dCol: 0 } },
      { id: 'select-cell', name: 'Table: Select Cell', op: { type: 'selectCell' } },
      { id: 'insert-row', name: 'Table: Insert Row', op: { type: 'insertRow' } },
      { id: 'insert-column', name: 'Table: Insert Column', op: { type: 'insertColumn' } },
      { id: 'delete-row', name: 'Table: Delete Row', op: { type: 'deleteRow' } },
      { id: 'delete-column', name: 'Table: Delete Column', op: { type: 'deleteColumn' } },
      { id: 'move-row-up', name: 'Table: Move Row Up', op: { type: 'moveRow', dir: -1 } },
      { id: 'move-row-down', name: 'Table: Move Row Down', op: { type: 'moveRow', dir: 1 } },
      {
        id: 'move-column-left',
        name: 'Table: Move Column Left',
        op: { type: 'moveColumn', dir: -1 },
      },
      {
        id: 'move-column-right',
        name: 'Table: Move Column Right',
        op: { type: 'moveColumn', dir: 1 },
      },
      { id: 'align-left', name: 'Table: Align Left', op: { type: 'align', alignment: 'left' } },
      {
        id: 'align-center',
        name: 'Table: Align Center',
        op: { type: 'align', alignment: 'center' },
      },
      { id: 'align-right', name: 'Table: Align Right', op: { type: 'align', alignment: 'right' } },
      { id: 'align-none', name: 'Table: Align Default', op: { type: 'align', alignment: 'none' } },
      { id: 'format', name: 'Table: Format', op: { type: 'format' } },
      { id: 'escape', name: 'Table: Leave Table', op: { type: 'escape' } },
    ];

    const unregisterTableCommands = tableCommands.map(command =>
      context.registerCommand({ id: command.id, name: command.name, icon: 'Table' }, () =>
        applyOp(command.op)
      )
    );

    const unregisterFormatAll = context.registerCommand(
      { id: 'format-all', name: 'Table: Format All', icon: 'Table' },
      () => {
        const content = context.editor.getContent();
        const next = formatAllTables(content);
        if (next === content) return false;
        context.editor.replaceRange(0, content.length, next);
        return true;
      }
    );

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
        unregisterTableKeys();
        unregisterFormatAll();
        for (const unregister of unregisterTableCommands) unregister();
      },
    };
  },
};
