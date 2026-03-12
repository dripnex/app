import { describe, it, expect, beforeEach } from 'vitest';
import { rehypePluginStore } from '../src/preview/rehypePluginStore';

const defaultMeta = { name: 'test', version: '1.0.0', priority: 100 };

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
      metadata: defaultMeta,
    });

    expect(rehypePluginStore.getState().registrations).toHaveLength(1);
    expect(rehypePluginStore.getState().registrations[0]!.id).toBe('rehype-1');
  });

  it('replaces registration with same id', () => {
    rehypePluginStore.getState().register({
      id: 'rehype-1',
      pluginId: 'test-plugin',
      plugin: () => {},
      metadata: defaultMeta,
    });
    rehypePluginStore.getState().register({
      id: 'rehype-1',
      pluginId: 'test-plugin',
      plugin: () => {},
      metadata: defaultMeta,
    });

    expect(rehypePluginStore.getState().registrations).toHaveLength(1);
  });

  it('unregisters by id', () => {
    rehypePluginStore.getState().register({
      id: 'rehype-1',
      pluginId: 'test-plugin',
      plugin: () => {},
      metadata: defaultMeta,
    });
    rehypePluginStore.getState().unregister('rehype-1');

    expect(rehypePluginStore.getState().registrations).toEqual([]);
  });

  it('unregisterAll removes all for a pluginId', () => {
    rehypePluginStore.getState().register({
      id: 'rehype-1',
      pluginId: 'plugin-a',
      plugin: () => {},
      metadata: defaultMeta,
    });
    rehypePluginStore.getState().register({
      id: 'rehype-2',
      pluginId: 'plugin-a',
      plugin: () => {},
      metadata: defaultMeta,
    });
    rehypePluginStore.getState().register({
      id: 'rehype-3',
      pluginId: 'plugin-b',
      plugin: () => {},
      metadata: defaultMeta,
    });

    rehypePluginStore.getState().unregisterAll('plugin-a');

    const remaining = rehypePluginStore.getState().registrations;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.pluginId).toBe('plugin-b');
  });

  it('registers with default metadata values', () => {
    const fakePlugin = () => {};
    rehypePluginStore.getState().register({
      id: 'rehype-default',
      pluginId: 'test-plugin',
      plugin: fakePlugin,
      metadata: defaultMeta,
    });

    const reg = rehypePluginStore.getState().registrations[0]!;
    expect(reg.metadata.name).toBe('test');
    expect(reg.metadata.version).toBe('1.0.0');
    expect(reg.metadata.priority).toBe(100);
  });

  it('getPlugins returns plugins sorted by priority', () => {
    rehypePluginStore.getState().register({
      id: 'rehype-1',
      pluginId: 'plugin-a',
      plugin: 'pluginA',
      metadata: { name: 'a', version: '1.0.0', priority: 50 },
    });
    rehypePluginStore.getState().register({
      id: 'rehype-2',
      pluginId: 'plugin-b',
      plugin: 'pluginB',
      metadata: { name: 'b', version: '1.0.0', priority: 10 },
    });

    const plugins = rehypePluginStore.getState().getPlugins();
    expect(plugins).toHaveLength(2);
    // pluginB (priority 10) should come first
    expect(plugins[0]).toBe('pluginB');
    expect(plugins[1]).toBe('pluginA');
  });
});
