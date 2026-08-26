import { describe, expect, it } from 'vitest';
import { collectThemesFromPluginCode } from '../collectPluginThemes';

const DUNE_JS = `
module.exports = {
  id: 'theme-dune',
  name: 'Dune',
  version: '0.1.0',
  activate(context) {
    context.registerTheme({
      id: 'dripnex-dune',
      name: 'Dune',
      colorScheme: 'light',
      tokens: { '--bg-base': '#f0e4d0', '--accent': '#c45c26' },
    });
    context.log.info('ok');
    context.editor.getContent();
  },
};
`;

describe('collectThemesFromPluginCode', () => {
  it('collects registerTheme palettes from activate()', () => {
    const themes = collectThemesFromPluginCode(DUNE_JS, 'theme-dune');
    expect(themes).toHaveLength(1);
    expect(themes[0]?.id).toBe('dripnex-dune');
    expect(themes[0]?.pluginId).toBe('theme-dune');
    expect(themes[0]?.tokens['--bg-base']).toBe('#f0e4d0');
  });

  it('returns [] for empty or invalid source', () => {
    expect(collectThemesFromPluginCode('', 'theme-dune')).toEqual([]);
    expect(collectThemesFromPluginCode('not javascript {', 'theme-dune')).toEqual([]);
    expect(collectThemesFromPluginCode('throw new Error("eval")', 'theme-dune')).toEqual([]);
  });

  it('returns [] when activate never calls registerTheme', () => {
    const code = `
module.exports = {
  id: 'hello',
  name: 'Hello',
  version: '1.0.0',
  activate() {},
};
`;
    expect(collectThemesFromPluginCode(code, 'hello')).toEqual([]);
  });
});
