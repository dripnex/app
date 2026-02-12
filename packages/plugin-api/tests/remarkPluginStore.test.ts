import { describe, it, expect, beforeEach } from 'vitest';
import { remarkPluginStore } from '../src/preview/remarkPluginStore';

describe('remarkPluginStore', () => {
  beforeEach(() => {
    const state = remarkPluginStore.getState();
    for (const r of state.registrations) {
      state.unregister(r.id);
    }
  });

  it('starts with empty registrations', () => {
    expect(remarkPluginStore.getState().registrations).toEqual([]);
  });

  it('registers a remark plugin', () => {
    const fakePlugin = () => {};
    remarkPluginStore.getState().register({
      id: 'remark-1',
      pluginId: 'test-plugin',
      plugin: fakePlugin,
    });

    expect(remarkPluginStore.getState().registrations).toHaveLength(1);
    expect(remarkPluginStore.getState().registrations[0]!.id).toBe('remark-1');
  });

  it('replaces registration with same id', () => {
    remarkPluginStore.getState().register({
      id: 'remark-1',
      pluginId: 'test-plugin',
      plugin: () => {},
    });
    remarkPluginStore.getState().register({
      id: 'remark-1',
      pluginId: 'test-plugin',
      plugin: () => {},
    });

    expect(remarkPluginStore.getState().registrations).toHaveLength(1);
  });

  it('unregisters by id', () => {
    remarkPluginStore.getState().register({
      id: 'remark-1',
      pluginId: 'test-plugin',
      plugin: () => {},
    });
    remarkPluginStore.getState().unregister('remark-1');

    expect(remarkPluginStore.getState().registrations).toEqual([]);
  });

  it('unregisterAll removes all for a pluginId', () => {
    remarkPluginStore.getState().register({
      id: 'remark-1',
      pluginId: 'plugin-a',
      plugin: () => {},
    });
    remarkPluginStore.getState().register({
      id: 'remark-2',
      pluginId: 'plugin-a',
      plugin: () => {},
    });
    remarkPluginStore.getState().register({
      id: 'remark-3',
      pluginId: 'plugin-b',
      plugin: () => {},
    });

    remarkPluginStore.getState().unregisterAll('plugin-a');

    const remaining = remarkPluginStore.getState().registrations;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.pluginId).toBe('plugin-b');
  });

  it('getPlugins returns flat array of plugin functions', () => {
    const pluginA = () => {};
    const pluginB = () => {};

    remarkPluginStore.getState().register({
      id: 'remark-1',
      pluginId: 'plugin-a',
      plugin: pluginA,
    });
    remarkPluginStore.getState().register({
      id: 'remark-2',
      pluginId: 'plugin-b',
      plugin: pluginB,
    });

    expect(remarkPluginStore.getState().getPlugins()).toEqual([pluginA, pluginB]);
  });
});
