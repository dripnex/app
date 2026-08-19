import { describe, expect, it } from 'vitest';
import { remarkFenceMeta } from '../remarkFenceMeta';

describe('remarkFenceMeta', () => {
  it('writes dataFilename onto fenced code nodes', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'code', lang: 'ts', meta: 'title=src/a.ts', value: 'x' },
        { type: 'code', lang: 'ts', value: 'y' },
      ],
    };
    remarkFenceMeta()(tree);
    const [titled, plain] = tree.children;
    expect(titled && 'data' in titled ? titled.data : undefined).toEqual({
      hProperties: { dataFilename: 'src/a.ts' },
    });
    expect(plain && 'data' in plain ? plain.data : undefined).toBeUndefined();
  });
});
