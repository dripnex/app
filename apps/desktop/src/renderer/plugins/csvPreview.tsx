import type { PluginManifest, CodeBlockRendererProps } from '@dripnex/plugin-api';

/** Wrap the selection (or the cursor) in a csv/tsv fence. Does not rewrite the rest of the note. */
export function csvFencePlan(
  from: number,
  to: number,
  selected: string,
  language: 'csv' | 'tsv' = 'csv'
): { from: number; to: number; text: string; cursor: number } {
  const body = selected.replace(/\s+$/, '');
  const open = `\`\`\`${language}\n`;
  const text = `${open}${body}\n\`\`\``;
  return { from, to, text, cursor: open.length + body.length };
}

export function parseDelimited(code: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;

  const flushCell = () => {
    row.push(cell.trim());
    cell = '';
  };
  const flushRow = () => {
    flushCell();
    if (row.some(value => value.length > 0)) rows.push(row);
    row = [];
  };

  while (i < code.length) {
    const ch = code[i] ?? '';
    if (quoted) {
      if (ch === '"') {
        if (code[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      flushCell();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      flushRow();
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell.length > 0 || row.length > 0) flushRow();
  return rows;
}

function CsvTable({ code, language }: CodeBlockRendererProps) {
  const rows = parseDelimited(code, language === 'tsv' ? '\t' : ',');
  if (rows.length === 0) {
    return <pre>{code}</pre>;
  }
  const [header, ...body] = rows;
  return (
    <div
      style={{
        overflow: 'auto',
        margin: '8px 0',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {(header ?? []).map((cell, i) => (
              <th
                key={i}
                style={{
                  textAlign: 'left',
                  padding: '6px 10px',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-surface)',
                }}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td
                  key={c}
                  style={{
                    padding: '6px 10px',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const csvPreviewPlugin: PluginManifest = {
  id: 'dripnex-csv',
  name: 'CSV Preview',
  version: '1.0.0',
  description: 'Insert csv/tsv fences and render them as a table in preview',

  activate(context) {
    const insert = (language: 'csv' | 'tsv') => {
      const { from, to } = context.editor.getSelection();
      const selected = context.editor.getContent().slice(from, to);
      const plan = csvFencePlan(from, to, selected, language);
      context.editor.replaceRange(plan.from, plan.to, plan.text);
      context.editor.setSelection(plan.from + plan.cursor);
      context.editor.focus();
      return true;
    };

    const csv = context.registerCodeBlockRenderer('csv', 'csv', CsvTable);
    const tsv = context.registerCodeBlockRenderer('tsv', 'tsv', CsvTable);
    const unregisterCsv = context.registerCommand(
      { id: 'insert-csv', name: 'Insert CSV Fence', icon: 'FileCode' },
      () => insert('csv')
    );
    const unregisterTsv = context.registerCommand(
      { id: 'insert-tsv', name: 'Insert TSV Fence', icon: 'FileCode' },
      () => insert('tsv')
    );
    return {
      dispose() {
        csv();
        tsv();
        unregisterCsv();
        unregisterTsv();
      },
    };
  },
};
