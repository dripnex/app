import { describe, it, expect, beforeEach } from 'vitest';
import { editorPluginStore } from '../src/editor/editorPluginStore';

describe('editorPluginStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    const state = editorPluginStore.getState();
    for (const r of state.registrations) {
      state.unregister(r.id);
    }
  });

  it('starts with empty registrations', () => {
    expect(editorPluginStore.getState().registrations).toEqual([]);
  });

  it('registers an extension', () => {
    editorPluginStore.getState().register({
      id: 'ext-1',
      pluginId: 'test-plugin',
      extensions: [],
    });

    expect(editorPluginStore.getState().registrations).toHaveLength(1);
    expect(editorPluginStore.getState().registrations[0]!.id).toBe('ext-1');
  });

  it('replaces registration with same id', () => {
    editorPluginStore.getState().register({
      id: 'ext-1',
      pluginId: 'test-plugin',
      extensions: [],
    });
    editorPluginStore.getState().register({
      id: 'ext-1',
      pluginId: 'test-plugin',
      extensions: [],
    });

    expect(editorPluginStore.getState().registrations).toHaveLength(1);
  });

  it('unregisters by id', () => {
    editorPluginStore.getState().register({
      id: 'ext-1',
      pluginId: 'test-plugin',
      extensions: [],
    });
    editorPluginStore.getState().unregister('ext-1');

    expect(editorPluginStore.getState().registrations).toEqual([]);
  });

  it('unregisterAll removes all for a pluginId', () => {
    editorPluginStore.getState().register({
      id: 'ext-1',
      pluginId: 'plugin-a',
      extensions: [],
    });
    editorPluginStore.getState().register({
      id: 'ext-2',
      pluginId: 'plugin-a',
      extensions: [],
    });
    editorPluginStore.getState().register({
      id: 'ext-3',
      pluginId: 'plugin-b',
      extensions: [],
    });

    editorPluginStore.getState().unregisterAll('plugin-a');

    const remaining = editorPluginStore.getState().registrations;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.pluginId).toBe('plugin-b');
  });

  it('getMergedExtensions returns flat array of all extensions', () => {
    const ext1 = {} as never; // Extensions are opaque CM6 objects
    const ext2 = {} as never;
    const ext3 = {} as never;

    editorPluginStore.getState().register({
      id: 'ext-1',
      pluginId: 'plugin-a',
      extensions: [ext1, ext2],
    });
    editorPluginStore.getState().register({
      id: 'ext-2',
      pluginId: 'plugin-b',
      extensions: [ext3],
    });

    expect(editorPluginStore.getState().getMergedExtensions()).toEqual([ext1, ext2, ext3]);
  });
});
