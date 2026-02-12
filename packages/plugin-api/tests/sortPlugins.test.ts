import { describe, it, expect, vi } from 'vitest';
import { sortPlugins } from '../src/lifecycle/sortPlugins';
import type { PluginManifest } from '../src/types';

function makePlugin(id: string, deps?: Record<string, string>): PluginManifest {
  return {
    id,
    name: id,
    version: '1.0.0',
    dependencies: deps,
    activate: () => {},
  };
}

describe('sortPlugins', () => {
  it('returns plugins unchanged when no dependencies', () => {
    const plugins = [makePlugin('a'), makePlugin('b'), makePlugin('c')];
    const { sorted, skipped } = sortPlugins(plugins);

    expect(sorted.map(p => p.id)).toEqual(['a', 'b', 'c']);
    expect(skipped).toEqual([]);
  });

  it('sorts dependencies before dependents', () => {
    const plugins = [
      makePlugin('consumer', { provider: '>=1.0.0' }),
      makePlugin('provider'),
    ];
    const { sorted, skipped } = sortPlugins(plugins);

    expect(sorted.map(p => p.id)).toEqual(['provider', 'consumer']);
    expect(skipped).toEqual([]);
  });

  it('handles multi-level dependency chains', () => {
    const plugins = [
      makePlugin('c', { b: '*' }),
      makePlugin('b', { a: '*' }),
      makePlugin('a'),
    ];
    const { sorted, skipped } = sortPlugins(plugins);

    const ids = sorted.map(p => p.id);
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('c'));
    expect(skipped).toEqual([]);
  });

  it('skips plugins with missing dependencies', () => {
    const plugins = [
      makePlugin('orphan', { 'does-not-exist': '*' }),
      makePlugin('ok'),
    ];
    const { sorted, skipped } = sortPlugins(plugins);

    expect(sorted.map(p => p.id)).toEqual(['ok']);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].plugin.id).toBe('orphan');
    expect(skipped[0].missingDeps).toEqual(['does-not-exist']);
  });

  it('handles diamond dependencies', () => {
    //     a
    //    / \
    //   b   c
    //    \ /
    //     d
    const plugins = [
      makePlugin('d', { b: '*', c: '*' }),
      makePlugin('b', { a: '*' }),
      makePlugin('c', { a: '*' }),
      makePlugin('a'),
    ];
    const { sorted, skipped } = sortPlugins(plugins);

    const ids = sorted.map(p => p.id);
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('c'));
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('d'));
    expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('d'));
    expect(skipped).toEqual([]);
  });

  it('handles circular dependencies gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const plugins = [
      makePlugin('a', { b: '*' }),
      makePlugin('b', { a: '*' }),
    ];
    const { sorted, skipped } = sortPlugins(plugins);

    // Both should still be included (cycle broken)
    expect(sorted).toHaveLength(2);
    expect(skipped).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns empty for empty input', () => {
    const { sorted, skipped } = sortPlugins([]);
    expect(sorted).toEqual([]);
    expect(skipped).toEqual([]);
  });

  it('handles plugins with undefined dependencies', () => {
    const plugins = [makePlugin('a'), makePlugin('b')];
    // dependencies is undefined by default in makePlugin
    const { sorted } = sortPlugins(plugins);
    expect(sorted).toHaveLength(2);
  });

  it('handles multiple missing dependencies', () => {
    const plugins = [
      makePlugin('broken', { dep1: '*', dep2: '*' }),
    ];
    const { sorted, skipped } = sortPlugins(plugins);

    expect(sorted).toEqual([]);
    expect(skipped[0].missingDeps).toEqual(['dep1', 'dep2']);
  });

  it('skips dependents of skipped plugins (cascade)', () => {
    const plugins = [
      makePlugin('a', { missing: '1.0.0' }),
      makePlugin('b', { a: '1.0.0' }),
      makePlugin('c'), // no deps, should be sorted
    ];
    const { sorted, skipped } = sortPlugins(plugins);

    expect(sorted.map(p => p.id)).toEqual(['c']);
    expect(skipped).toHaveLength(2);
    expect(skipped.map(s => s.plugin.id)).toContain('a');
    expect(skipped.map(s => s.plugin.id)).toContain('b');
  });

  it('cascades skips through multi-level chains', () => {
    const plugins = [
      makePlugin('a', { missing: '*' }),
      makePlugin('b', { a: '*' }),
      makePlugin('c', { b: '*' }),
      makePlugin('d'),
    ];
    const { sorted, skipped } = sortPlugins(plugins);

    expect(sorted.map(p => p.id)).toEqual(['d']);
    expect(skipped).toHaveLength(3);
    expect(skipped.map(s => s.plugin.id)).toContain('a');
    expect(skipped.map(s => s.plugin.id)).toContain('b');
    expect(skipped.map(s => s.plugin.id)).toContain('c');
  });
});
