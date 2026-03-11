import { describe, it, expect, beforeEach } from 'vitest';
import { themeRegistryStore } from '../src/theme/themeRegistryStore';

const makeTheme = (overrides = {}) => ({
  id: 'test-theme',
  name: 'Test Theme',
  colorScheme: 'dark' as const,
  tokens: { '--bg-base': '#111', '--text-primary': '#eee' },
  pluginId: 'test-plugin',
  ...overrides,
});

describe('themeRegistryStore', () => {
  beforeEach(() => {
    const state = themeRegistryStore.getState();
    for (const t of state.themes) {
      state.unregister(t.id);
    }
    state.setActive(null);
  });

  it('registers a valid theme', () => {
    const result = themeRegistryStore.getState().register(makeTheme());
    expect(result).toBe(true);
    expect(themeRegistryStore.getState().themes).toHaveLength(1);
  });

  it('rejects theme with no valid tokens', () => {
    const result = themeRegistryStore
      .getState()
      .register(makeTheme({ tokens: { '--invalid': 'red' } }));
    expect(result).toBe(false);
    expect(themeRegistryStore.getState().themes).toHaveLength(0);
  });

  it('strips invalid tokens but keeps valid ones', () => {
    themeRegistryStore
      .getState()
      .register(makeTheme({ tokens: { '--bg-base': '#000', '--nope': 'red' } }));
    const theme = themeRegistryStore.getState().themes[0]!;
    expect(theme.tokens).toEqual({ '--bg-base': '#000' });
  });

  it('replaces theme with same id', () => {
    themeRegistryStore.getState().register(makeTheme({ name: 'V1' }));
    themeRegistryStore.getState().register(makeTheme({ name: 'V2' }));
    expect(themeRegistryStore.getState().themes).toHaveLength(1);
    expect(themeRegistryStore.getState().themes[0]!.name).toBe('V2');
  });

  it('unregister removes theme and deactivates if active', () => {
    themeRegistryStore.getState().register(makeTheme());
    themeRegistryStore.getState().setActive('test-theme');
    themeRegistryStore.getState().unregister('test-theme');
    expect(themeRegistryStore.getState().themes).toHaveLength(0);
    expect(themeRegistryStore.getState().activeThemeId).toBeNull();
  });

  it('unregisterAll removes all themes for a plugin', () => {
    themeRegistryStore.getState().register(makeTheme({ id: 'a', pluginId: 'p1' }));
    themeRegistryStore.getState().register(makeTheme({ id: 'b', pluginId: 'p1' }));
    themeRegistryStore.getState().register(makeTheme({ id: 'c', pluginId: 'p2' }));
    themeRegistryStore.getState().unregisterAll('p1');
    expect(themeRegistryStore.getState().themes).toHaveLength(1);
    expect(themeRegistryStore.getState().themes[0]!.id).toBe('c');
  });

  it('setActive ignores unknown theme ID', () => {
    themeRegistryStore.getState().setActive('nonexistent');
    expect(themeRegistryStore.getState().activeThemeId).toBeNull();
  });

  it('getActiveTheme returns the active theme', () => {
    themeRegistryStore.getState().register(makeTheme());
    themeRegistryStore.getState().setActive('test-theme');
    const active = themeRegistryStore.getState().getActiveTheme();
    expect(active?.id).toBe('test-theme');
  });

  it('getActiveTheme returns null when no theme active', () => {
    expect(themeRegistryStore.getState().getActiveTheme()).toBeNull();
  });
});
