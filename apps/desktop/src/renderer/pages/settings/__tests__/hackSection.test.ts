import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HACK_FILE_ACTIONS } from '../hackFiles';
import { SETTINGS_NAV_ITEMS } from '../settingsNav';

const here = dirname(fileURLToPath(import.meta.url));

describe('Settings → Hack nav', () => {
  it('lists Hack as its own top-level nav item, not nested under Plugins', () => {
    const ids = SETTINGS_NAV_ITEMS.map(item => item.id);
    expect(ids).toContain('hack');
    expect(ids).toContain('plugins');
    expect(ids.indexOf('hack')).toBeLessThan(ids.indexOf('plugins'));
    expect(SETTINGS_NAV_ITEMS.find(item => item.id === 'hack')?.label).toBe('Hack');
  });

  it('wires Hack into SettingsApp and the sidebar list', () => {
    const app = readFileSync(join(here, '../SettingsApp.tsx'), 'utf-8');
    const sidebar = readFileSync(join(here, '../components/SettingsSidebar.tsx'), 'utf-8');

    expect(app).toContain("case 'hack'");
    expect(app).toContain('<HackSection');
    expect(sidebar).toContain('SETTINGS_NAV_ITEMS');
    expect(sidebar).toContain('hack:');
  });

  it('exposes Open init.js, Open styles.css, and Open keymap', () => {
    expect(HACK_FILE_ACTIONS.map(action => action.kind)).toEqual(['init', 'styles', 'keymap']);
    expect(HACK_FILE_ACTIONS.map(action => action.button)).toEqual([
      'Open init.js',
      'Open styles.css',
      'Open keymap',
    ]);
  });

  it('keeps Plugins → Open init.js / styles.css on the same IPC', () => {
    const plugins = readFileSync(join(here, '../sections/plugins/index.tsx'), 'utf-8');
    const handlers = readFileSync(join(here, '../../../main/handlers/pluginHandlers.ts'), 'utf-8');
    const preload = readFileSync(join(here, '../../../preload/api/plugins.ts'), 'utf-8');

    expect(plugins).toContain("handleOpenUserFile('init')");
    expect(plugins).toContain("handleOpenUserFile('styles')");
    expect(plugins).toContain('Open init.js');
    expect(plugins).toContain('Open styles.css');
    expect(plugins).toContain('window.dripnex.plugins.openUserFile');

    expect(handlers).toContain('OPEN_USER_FILE_CHANNEL');
    expect(handlers).toContain('openUserHackFile(paths.root, kind)');
    expect(preload).toContain("ipcRenderer.invoke('plugins:openUserFile'");
  });
});
