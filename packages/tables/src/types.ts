export type TableAlignment = 'left' | 'center' | 'right' | 'none';

export interface ParsedTable {
  headers: string[];
  alignments: TableAlignment[];
  rows: string[][];
  from: number;
  to: number;
  text: string;
}

export interface TableRange {
  from: number;
  to: number;
  text: string;
}
