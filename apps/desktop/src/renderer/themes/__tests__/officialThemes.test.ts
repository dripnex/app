import { describe, expect, it } from 'vitest';
import { validateThemeTokens } from '@dripnex/plugin-api';
import { OFFICIAL_THEMES } from '../officialThemes';

describe('OFFICIAL_THEMES', () => {
  it('registers unique ids with only valid tokens', () => {
    const ids = OFFICIAL_THEMES.map(theme => theme.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const theme of OFFICIAL_THEMES) {
      expect(theme.name.length).toBeGreaterThan(0);
      expect(['dark', 'light']).toContain(theme.colorScheme);
      const valid = validateThemeTokens(theme.tokens, theme.id);
      for (const [token, value] of Object.entries(theme.tokens)) {
        expect(valid[token]).toBe(value);
      }
      expect(valid['--accent-primary']).toBe(theme.tokens['--accent']);
    }
  });

  it('includes Harbor Dusk as a dark official palette', () => {
    const harbor = OFFICIAL_THEMES.find(theme => theme.id === 'dripnex-harbor-dusk');
    expect(harbor).toMatchObject({
      name: 'Harbor Dusk',
      colorScheme: 'dark',
      pluginId: 'dripnex',
    });
    expect(harbor?.tokens['--bg-base']).toBe('#141c26');
    expect(harbor?.tokens['--accent']).toBe('#5e9a92');
    expect(harbor?.tokens['--cm-link']).toBe('#d4a05a');
  });
});
