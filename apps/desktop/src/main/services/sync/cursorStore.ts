import { promises as fs } from 'fs';

export interface SyncCursors {
  cursor: number;
  tagCursor: number;
  notebookCursor: number;
}

const EMPTY: SyncCursors = { cursor: 0, tagCursor: 0, notebookCursor: 0 };

export class SyncCursorStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<SyncCursors> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<SyncCursors>;
      return {
        cursor: nonNeg(parsed.cursor),
        tagCursor: nonNeg(parsed.tagCursor),
        notebookCursor: nonNeg(parsed.notebookCursor),
      };
    } catch {
      return { ...EMPTY };
    }
  }

  async save(cursors: SyncCursors): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(cursors), { encoding: 'utf8', mode: 0o600 });
  }
}

function nonNeg(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}
