import { describe, it, expect, beforeEach } from 'vitest';
import { remarkPluginStore } from '../src/preview/remarkPluginStore';

const defaultMeta = { name: 'test', version: '1.0.0', priority: 100 };

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
      metadata: defaultMeta,
    });

    expect(remarkPluginStore.getState().registrations).toHaveLength(1);
    expect(remarkPluginStore.getState().registrations[0]!.id).toBe('remark-1');
  });

  it('replaces registration with same id', () => {
    remarkPluginStore.getState().register({
      id: 'remark-1',
      pluginId: 'test-plugin',
      plugin: () => {},
      metadata: defaultMeta,
    });
    remarkPluginStore.getState().register({
      id: 'remark-1',
      pluginId: 'test-plugin',
      plugin: () => {},
      metadata: defaultMeta,
    });

    expect(remarkPluginStore.getState().registrations).toHaveLength(1);
  });

  it('unregisters by id', () => {
    remarkPluginStore.getState().register({
      id: 'remark-1',
      pluginId: 'test-plugin',
      plugin: () => {},
      metadata: defaultMeta,
    });
    remarkPluginStore.getState().unregister('remark-1');

    expect(remarkPluginStore.getState().registrations).toEqual([]);
  });

  it('unregisterAll removes all for a pluginId', () => {
    remarkPluginStore.getState().register({
      id: 'remark-1',
      pluginId: 'plugin-a',
      plugin: () => {},
      metadata: defaultMeta,
    });
    remarkPluginStore.getState().register({
      id: 'remark-2',
      pluginId: 'plugin-a',
      plugin: () => {},
      metadata: defaultMeta,
    });
    remarkPluginStore.getState().register({
      id: 'remark-3',
      pluginId: 'plugin-b',
      plugin: () => {},
      metadata: defaultMeta,
    });

    remarkPluginStore.getState().unregisterAll('plugin-a');

    const remaining = remarkPluginStore.getState().registrations;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.pluginId).toBe('plugin-b');
  });

  it('getPlugins returns plugins sorted by priority', () => {
    remarkPluginStore.getState().register({
      id: 'remark-1',
      pluginId: 'plugin-a',
      plugin: 'pluginA',
      metadata: { name: 'a', version: '1.0.0', priority: 50 },
    });
    remarkPluginStore.getState().register({
      id: 'remark-2',
      pluginId: 'plugin-b',
      plugin: 'pluginB',
      metadata: { name: 'b', version: '1.0.0', priority: 10 },
    });

    const plugins = remarkPluginStore.getState().getPlugins();
    expect(plugins).toHaveLength(2);
    // pluginB (priority 10) should come first
    expect(plugins[0]).toBe('pluginB');
    expect(plugins[1]).toBe('pluginA');
  });
});
