import { describe, expect, it } from 'vitest';
import { applyTableOp, formatAllTables, locateCell, serializeGfmTable } from '../src/edit.js';
import { parseGfmTable } from '../src/parse.js';

const DOC = ['# Title', '', '| A | B |', '| --- | --- |', '| 1 | 2 |', '', 'after'].join('\n');

describe('locateCell', () => {
  it('finds the header and body cells', () => {
    const a = DOC.indexOf('A');
    const one = DOC.indexOf('1');
    expect(locateCell(DOC, a)).toMatchObject({ row: 0, col: 0 });
    expect(locateCell(DOC, one)).toMatchObject({ row: 1, col: 0 });
    expect(locateCell(DOC, DOC.indexOf('2'))).toMatchObject({ row: 1, col: 1 });
  });

  it('returns null outside a table', () => {
    expect(locateCell(DOC, 0)).toBeNull();
  });
});

describe('applyTableOp', () => {
  it('moves to the next cell and wraps by adding a row', () => {
    const pos = DOC.indexOf('2');
    const next = applyTableOp(DOC, pos, { type: 'nextCell' });
    expect(next?.text.split('\n')).toHaveLength(4);
    expect(next?.text).toContain('| 1 | 2 |');

    const prev = applyTableOp(DOC, pos, { type: 'prevCell' });
    expect(prev?.text).toContain('| A | B |');
    expect(DOC.slice(prev!.cursorFrom, prev!.cursorTo).trim()).toBe('1');
  });

  it('inserts and deletes columns', () => {
    const pos = DOC.indexOf('A');
    const inserted = applyTableOp(DOC, pos, { type: 'insertColumn' });
    expect(inserted?.text.split('\n')[0]).toBe('| A |  | B |');

    const next = DOC.slice(0, inserted!.from) + inserted!.text + DOC.slice(inserted!.to);
    const deleted = applyTableOp(next, inserted!.cursorFrom, { type: 'deleteColumn' });
    expect(deleted?.text.split('\n')[0]).toBe('| A | B |');
  });

  it('aligns a column', () => {
    const pos = DOC.indexOf('B');
    const aligned = applyTableOp(DOC, pos, { type: 'align', alignment: 'right' });
    expect(aligned?.text.split('\n')[1]).toContain('---:');
  });

  it('formats every table', () => {
    const messy = '|A|B|\n|---|---|\n|1|2|';
    const parsed = parseGfmTable(messy, 0);
    expect(parsed).not.toBeNull();
    const pretty = serializeGfmTable(parsed!, true);
    expect(pretty.split('\n')[0]).toMatch(/\| A\s+\| B\s+\|/);
    expect(formatAllTables(`intro\n${messy}\n`)).toMatch(/\| A\s+\| B\s+\|/);
  });
});
