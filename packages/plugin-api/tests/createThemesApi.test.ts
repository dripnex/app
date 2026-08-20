import { describe, it, expect, beforeEach } from 'vitest';
import { themeRegistryStore } from '../src/theme/themeRegistryStore';
import { createThemesApi } from '../src/theme/createThemesApi';
import { setHostThemeActive } from '../src/loader/hostBridges';

describe('createThemesApi', () => {
  beforeEach(() => {
    for (const theme of [...themeRegistryStore.getState().themes]) {
      themeRegistryStore.getState().unregister(theme.id);
    }
    themeRegistryStore.getState().setActive(null);
    setHostThemeActive(null);
  });

  it('lists registered palettes and activates one', () => {
    themeRegistryStore.getState().register({
      id: 'paper',
      name: 'Paper',
      colorScheme: 'light',
      tokens: { '--bg-base': '#fff' },
    });
    const api = createThemesApi();
    expect(api.list()).toEqual([
      { id: 'paper', name: 'Paper', colorScheme: 'light', description: undefined },
    ]);
    expect(api.setActive('paper')).toBe(true);
    expect(api.getActive()?.id).toBe('paper');
    expect(api.setActive(null)).toBe(true);
    expect(api.getActive()).toBeNull();
  });

  it('notifies onDidChange', () => {
    themeRegistryStore.getState().register({
      id: 'paper',
      name: 'Paper',
      colorScheme: 'light',
      tokens: { '--bg-base': '#fff' },
    });
    const api = createThemesApi();
    const seen: Array<string | null> = [];
    const off = api.onDidChange(id => seen.push(id));
    api.setActive('paper');
    api.setActive('paper');
    off();
    expect(seen).toEqual(['paper']);
  });
});
