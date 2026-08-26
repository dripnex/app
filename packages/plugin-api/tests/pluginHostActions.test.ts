import { describe, expect, it } from 'vitest';
import { nextPluginHostActions, planPluginHostSync } from '../src/lifecycle/pluginHostActions';
import type { PluginManifest } from '../src/types';

function plugin(id: string, deps?: Record<string, string>): PluginManifest {
  return { id, name: id, version: '1.0.0', dependencies: deps, activate: () => {} };
}

describe('nextPluginHostActions', () => {
  const vim = plugin('dripnex-vim-mode');
  const tables = plugin('tables');
  const limestone = plugin('theme-limestone');

  it('activates only the newly installed pack and leaves existing plugins loaded', () => {
    const actions = nextPluginHostActions(
      ['dripnex-vim-mode', 'tables'],
      ['dripnex-vim-mode', 'tables'],
      [vim, tables, limestone]
    );
    expect(actions.unload).toEqual([]);
    expect(actions.activate.map(p => p.id)).toEqual(['theme-limestone']);
  });

  it('is a no-op when the same ids are re-scanned', () => {
    const actions = nextPluginHostActions(
      ['dripnex-vim-mode', 'theme-limestone'],
      ['dripnex-vim-mode', 'theme-limestone'],
      [vim, limestone]
    );
    expect(actions.unload).toEqual([]);
    expect(actions.activate).toEqual([]);
  });

  it('unloads a pack that disappeared without touching the rest', () => {
    const actions = nextPluginHostActions(
      ['dripnex-vim-mode', 'theme-limestone'],
      ['dripnex-vim-mode', 'theme-limestone'],
      [vim]
    );
    expect(actions.unload).toEqual(['theme-limestone']);
    expect(actions.activate).toEqual([]);
  });

  it('retries a loaded pack that is not active yet', () => {
    const actions = nextPluginHostActions(['theme-limestone'], [], [limestone]);
    expect(actions.unload).toEqual([]);
    expect(actions.activate.map(p => p.id)).toEqual(['theme-limestone']);
  });
});

describe('planPluginHostSync', () => {
  const base = plugin('base');
  const extension = plugin('extension', { base: '*' });

  it('activates a new extension whose base is already active', () => {
    const plan = planPluginHostSync(['base'], ['base'], [base, extension]);
    expect(plan.unload).toEqual([]);
    expect(plan.skipped).toEqual([]);
    expect(plan.activate.map(p => p.id)).toEqual(['extension']);
  });

  it('unloads an extension whose base disappeared', () => {
    const plan = planPluginHostSync(['base', 'extension'], ['base', 'extension'], [extension]);
    expect(plan.activate).toEqual([]);
    expect(plan.skipped.map(s => s.plugin.id)).toEqual(['extension']);
    expect(plan.skipped[0]?.missingDeps).toEqual(['base']);
    expect(plan.unload).toEqual(['base', 'extension']);
  });
});
