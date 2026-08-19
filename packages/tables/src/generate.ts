import type { ParsedTable } from './types.js';

export function generateGfmTable(rows: number, cols: number): string {
  const header =
    '| ' + Array.from({ length: cols }, (_, i) => `Column ${i + 1}`).join(' | ') + ' |';
  const separator = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
  const bodyRow = '| ' + Array.from({ length: cols }, () => '  ').join(' | ') + ' |';
  const body = Array.from({ length: rows }, () => bodyRow).join('\n');
  return `${header}\n${separator}\n${body}`;
}

export function tableToCsv(table: ParsedTable): string {
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
