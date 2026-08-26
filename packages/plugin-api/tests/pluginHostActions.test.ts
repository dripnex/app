import { describe, expect, it } from 'vitest';
import { nextPluginHostActions } from '../src/lifecycle/pluginHostActions';
import type { PluginManifest } from '../src/types';

function plugin(id: string): PluginManifest {
  return { id, name: id, version: '1.0.0', activate: () => {} };
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
