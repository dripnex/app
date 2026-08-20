import { mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { SyncCursorStore } from '../cursorStore.js';

describe('SyncCursorStore', () => {
  it('returns zeros when the file is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dripnex-cursors-'));
    const store = new SyncCursorStore(join(dir, 'sync-cursors.json'));
    expect(await store.load()).toEqual({ cursor: 0, tagCursor: 0, notebookCursor: 0 });
  });

  it('round-trips cursors', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dripnex-cursors-'));
    const path = join(dir, 'sync-cursors.json');
    const store = new SyncCursorStore(path);
    await store.save({ cursor: 12, tagCursor: 3, notebookCursor: 7 });
    expect(await store.load()).toEqual({ cursor: 12, tagCursor: 3, notebookCursor: 7 });
    const raw = await readFile(path, 'utf8');
    expect(JSON.parse(raw)).toEqual({ cursor: 12, tagCursor: 3, notebookCursor: 7 });
  });
});
