import { describe, it, expect, beforeEach } from 'vitest';
import { cssVariableStore } from '../src/theme/cssVariableStore';

describe('cssVariableStore', () => {
  beforeEach(() => {
    // Clear all registrations between tests
    const state = cssVariableStore.getState();
    for (const r of state.registrations) {
      state.unregister(r.id);
    }
  });

  it('starts with empty registrations', () => {
    expect(cssVariableStore.getState().registrations).toEqual([]);
  });

  it('registers CSS variables', () => {
    cssVariableStore.getState().register({
      id: 'theme-1',
      pluginId: 'my-plugin',
      variables: { '--accent': '#ff0000', '--bg-base': '#111' },
    });

    expect(cssVariableStore.getState().registrations).toHaveLength(1);
    expect(cssVariableStore.getState().registrations[0].variables).toEqual({
      '--accent': '#ff0000',
      '--bg-base': '#111',
    });
  });

  it('replaces registration with same id', () => {
    const store = cssVariableStore.getState();
    store.register({ id: 'theme-1', pluginId: 'p1', variables: { '--a': '1' } });
    store.register({ id: 'theme-1', pluginId: 'p1', variables: { '--a': '2' } });

    expect(cssVariableStore.getState().registrations).toHaveLength(1);
    expect(cssVariableStore.getState().registrations[0].variables['--a']).toBe('2');
  });

  it('unregisters by id', () => {
    const store = cssVariableStore.getState();
    store.register({ id: 'theme-1', pluginId: 'p1', variables: { '--a': '1' } });
    store.register({ id: 'theme-2', pluginId: 'p1', variables: { '--b': '2' } });

    store.unregister('theme-1');

    expect(cssVariableStore.getState().registrations).toHaveLength(1);
    expect(cssVariableStore.getState().registrations[0].id).toBe('theme-2');
  });

  it('unregisters all by pluginId', () => {
    const store = cssVariableStore.getState();
    store.register({ id: 'r1', pluginId: 'p1', variables: { '--a': '1' } });
    store.register({ id: 'r2', pluginId: 'p1', variables: { '--b': '2' } });
    store.register({ id: 'r3', pluginId: 'p2', variables: { '--c': '3' } });

    store.unregisterAll('p1');

    expect(cssVariableStore.getState().registrations).toHaveLength(1);
    expect(cssVariableStore.getState().registrations[0].pluginId).toBe('p2');
  });

  it('getMergedVariables merges all registrations', () => {
    const store = cssVariableStore.getState();
    store.register({ id: 'r1', pluginId: 'p1', variables: { '--a': '1', '--b': '2' } });
    store.register({ id: 'r2', pluginId: 'p2', variables: { '--c': '3' } });

    const merged = cssVariableStore.getState().getMergedVariables();
    expect(merged).toEqual({ '--a': '1', '--b': '2', '--c': '3' });
  });

  it('getMergedVariables: later registration overrides earlier', () => {
    const store = cssVariableStore.getState();
    store.register({ id: 'r1', pluginId: 'p1', variables: { '--accent': 'red' } });
    store.register({ id: 'r2', pluginId: 'p2', variables: { '--accent': 'blue' } });

    const merged = cssVariableStore.getState().getMergedVariables();
    expect(merged['--accent']).toBe('blue');
  });
});
