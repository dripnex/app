import { describe, expect, it } from 'vitest';
import { filterFenceLanguages, filterSlashItems, matchFenceLang, matchSlashLine } from './slash';

describe('matchSlashLine', () => {
  it('matches / on an empty line', () => {
    expect(matchSlashLine('/')).toEqual({ fromCol: 0, query: '' });
    expect(matchSlashLine('  /he')).toEqual({ fromCol: 2, query: 'he' });
  });

  it('ignores mid-line slashes', () => {
    expect(matchSlashLine('see /help')).toBeNull();
    expect(matchSlashLine('/ heading')).toBeNull();
  });
});

describe('filterSlashItems', () => {
  it('finds alerts and headings', () => {
    expect(filterSlashItems('h2').some(i => i.id === 'h2')).toBe(true);
    expect(filterSlashItems('caution').some(i => i.id === 'alert-caution')).toBe(true);
  });
});

describe('matchFenceLang', () => {
  it('matches an opening fence', () => {
    expect(matchFenceLang('```')).toEqual({ fromCol: 3, query: '' });
    expect(matchFenceLang('```ts')).toEqual({ fromCol: 3, query: 'ts' });
  });

  it('ignores closed or inner fences', () => {
    expect(matchFenceLang('```ts more')).toBeNull();
    expect(matchFenceLang('x```')).toBeNull();
  });

  it('filters languages by prefix', () => {
    expect(filterFenceLanguages('t')).toContain('ts');
    expect(filterFenceLanguages('t')).not.toContain('py');
  });
});
