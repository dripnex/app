import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';
import { ChangeLog } from '../localServer';

describe('ChangeLog', () => {
  it('increments seq and filters since', () => {
    const log = new ChangeLog();
    log.record('note', 'n1');
    log.record('book', 'b1');
    log.record('note', 'n1', true);
    expect(log.since(0).last_seq).toBe(3);
    expect(log.since(1).results).toEqual([
      { seq: 2, id: 'b1', kind: 'book' },
      { seq: 3, id: 'n1', kind: 'note', deleted: true },
    ]);
  });

  it('reloads seq from disk', async () => {
    const dir = join(tmpdir(), `dripnex-changes-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const path = join(dir, 'changes.json');
    try {
      const a = new ChangeLog();
      a.attach(path);
      a.record('note', 'n1');
      a.record('tag', 'ship');
      await a.flush();

      const b = new ChangeLog();
      b.attach(path);
      await b.load();
      expect(b.since(0).last_seq).toBe(2);
      expect(b.since(0).results.map(r => r.id)).toEqual(['n1', 'ship']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
