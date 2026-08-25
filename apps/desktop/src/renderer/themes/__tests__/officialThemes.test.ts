import { describe, expect, it, beforeEach } from 'vitest';
import { themeRegistryStore } from '@dripnex/plugin-api';
import {
  OFFICIAL_THEMES,
  RETIRED_BUNDLED_THEME_IDS,
  applyInstalledThemes,
  isRetiredBundledThemeId,
  parseInstalledThemes,
  persistClearedThemeIfNeeded,
  registerOfficialThemes,
  restoreSavedTheme,
} from '../officialThemes';

const SAMPLE_THEME_JSON = JSON.stringify({
  id: 'theme-parchment',
  name: 'Parchment',
  colorScheme: 'light',
  tokens: { '--bg-base': '#f3ead4', '--accent': '#2a7d6f' },
});

function resetRegistry(): void {
  applyInstalledThemes([]);
  const state = themeRegistryStore.getState();
  for (const theme of state.themes) {
    state.unregister(theme.id);
  }
  state.setActive(null);
}

describe('OFFICIAL_THEMES', () => {
  beforeEach(() => {
    resetRegistry();
  });

  it('does not bundle named first-party palettes', () => {
    expect(OFFICIAL_THEMES).toEqual([]);
    registerOfficialThemes();
    expect(themeRegistryStore.getState().themes).toHaveLength(0);
    for (const id of RETIRED_BUNDLED_THEME_IDS) {
      expect(themeRegistryStore.getState().themes.some(t => t.id === id)).toBe(false);
    }
  });

  it('treats the former bundled ids as retired', () => {
    expect(RETIRED_BUNDLED_THEME_IDS).toContain('dripnex-parchment');
    expect(RETIRED_BUNDLED_THEME_IDS).toContain('dripnex-harbor-dusk');
    expect(isRetiredBundledThemeId('dripnex-wave')).toBe(true);
    expect(isRetiredBundledThemeId('theme-parchment')).toBe(false);
  });
});

describe('restoreSavedTheme', () => {
  beforeEach(() => {
    resetRegistry();
  });

  it('clears the registry when no palette is saved', () => {
    expect(restoreSavedTheme(null)).toBe('cleared');
    expect(themeRegistryStore.getState().activeThemeId).toBeNull();
  });

  it('falls back to default for a retired bundled id', () => {
    expect(restoreSavedTheme('dripnex-parchment')).toBe('cleared');
    expect(themeRegistryStore.getState().activeThemeId).toBeNull();
  });

  it('persists null when a retired bundled id is still in settings', () => {
    const persisted: Array<null> = [];
    persistClearedThemeIfNeeded('dripnex-glass', 'cleared', id => persisted.push(id));
    expect(persisted).toEqual([null]);
  });

  it('does not persist when the saved id is already default', () => {
    const persisted: Array<null> = [];
    persistClearedThemeIfNeeded(null, 'cleared', id => persisted.push(id));
    expect(persisted).toEqual([]);
  });

  it('activates an installed plugin theme', () => {
    applyInstalledThemes(
      parseInstalledThemes([{ id: 'theme-parchment', themes: [SAMPLE_THEME_JSON] }], new Map())
    );
    expect(restoreSavedTheme('theme-parchment')).toBe('activated');
    expect(themeRegistryStore.getState().activeThemeId).toBe('theme-parchment');
  });

  it('waits for a plugin theme that has not loaded yet', () => {
    expect(restoreSavedTheme('theme-wave')).toBe('pending');
    expect(themeRegistryStore.getState().activeThemeId).toBeNull();
  });
});

describe('parseInstalledThemes / applyInstalledThemes', () => {
  beforeEach(() => {
    resetRegistry();
  });

  it('registers theme.json from enabled packs only', () => {
    const defs = parseInstalledThemes(
      [
        { id: 'theme-parchment', themes: [SAMPLE_THEME_JSON] },
        { id: 'dripnex-vim-mode', themes: [] },
        {
          id: 'theme-wave',
          themes: [
            JSON.stringify({
              id: 'theme-wave',
              name: 'Wave',
              colorScheme: 'dark',
              tokens: { '--bg-base': '#1f1f28' },
            }),
          ],
        },
      ],
      new Map([
        ['theme-parchment', true],
        ['theme-wave', false],
      ])
    );
    expect(defs.map(t => t.id)).toEqual(['theme-parchment']);
    applyInstalledThemes(defs);
    expect(themeRegistryStore.getState().themes.map(t => t.id)).toEqual(['theme-parchment']);
  });

  it('unregisters a pack that disappeared from the scan', () => {
    applyInstalledThemes(
      parseInstalledThemes([{ id: 'theme-parchment', themes: [SAMPLE_THEME_JSON] }], new Map())
    );
    applyInstalledThemes([]);
    expect(themeRegistryStore.getState().themes).toHaveLength(0);
  });
});
