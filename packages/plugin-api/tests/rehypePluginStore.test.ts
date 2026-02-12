import { describe, it, expect, beforeEach } from 'vitest';
import { rehypePluginStore } from '../src/preview/rehypePluginStore';

describe('rehypePluginStore', () => {
  beforeEach(() => {
    const state = rehypePluginStore.getState();
    for (const r of state.registrations) {
      state.unregister(r.id);
    }
  });

  it('starts with empty registrations', () => {
    expect(rehypePluginStore.getState().registrations).toEqual([]);
  });

  it('registers a rehype plugin', () => {
    const fakePlugin = () => {};
    rehypePluginStore.getState().register({
      id: 'rehype-1',
      pluginId: 'test-plugin',
      plugin: fakePlugin,
    });

    expect(rehypePluginStore.getState().registrations).toHaveLength(1);
    expect(rehypePluginStore.getState().registrations[0]!.id).toBe('rehype-1');
  });

  it('replaces registration with same id', () => {
    rehypePluginStore.getState().register({
      id: 'rehype-1',
      pluginId: 'test-plugin',
      plugin: () => {},
    });
    rehypePluginStore.getState().register({
      id: 'rehype-1',
      pluginId: 'test-plugin',
      plugin: () => {},
    });

    expect(rehypePluginStore.getState().registrations).toHaveLength(1);
  });

  it('unregisters by id', () => {
    rehypePluginStore.getState().register({
      id: 'rehype-1',
      pluginId: 'test-plugin',
      plugin: () => {},
    });
    rehypePluginStore.getState().unregister('rehype-1');

    expect(rehypePluginStore.getState().registrations).toEqual([]);
  });

  it('unregisterAll removes all for a pluginId', () => {
    rehypePluginStore.getState().register({
      id: 'rehype-1',
      pluginId: 'plugin-a',
      plugin: () => {},
    });
    rehypePluginStore.getState().register({
      id: 'rehype-2',
      pluginId: 'plugin-a',
      plugin: () => {},
    });
    rehypePluginStore.getState().register({
      id: 'rehype-3',
      pluginId: 'plugin-b',
      plugin: () => {},
    });

    rehypePluginStore.getState().unregisterAll('plugin-a');

    const remaining = rehypePluginStore.getState().registrations;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.pluginId).toBe('plugin-b');
  });

  it('getPlugins returns flat array of plugin functions', () => {
    const pluginA = () => {};
    const pluginB = () => {};

    rehypePluginStore.getState().register({
      id: 'rehype-1',
      pluginId: 'plugin-a',
      plugin: pluginA,
    });
    rehypePluginStore.getState().register({
      id: 'rehype-2',
      pluginId: 'plugin-b',
      plugin: pluginB,
    });

    expect(rehypePluginStore.getState().getPlugins()).toEqual([pluginA, pluginB]);
  });
});
