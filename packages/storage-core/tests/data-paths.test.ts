import { describe, expect, it } from 'vitest';
import { join } from 'path';
import {
  pickUserDataRoot,
  resolveUserDataRoot,
  userDataRootCandidates,
} from '../src/data/DataPaths.js';

describe('userDataRootCandidates', () => {
  it('lists packaged Dripnex first on Linux, Windows, and macOS', () => {
    expect(userDataRootCandidates({ platform: 'linux', home: '/home/tomas' })[0]).toBe(
      '/home/tomas/.config/Dripnex'
    );
    expect(
      userDataRootCandidates({
        platform: 'win32',
        home: 'C:\\Users\\tomas',
        appData: 'C:\\Users\\tomas\\AppData\\Roaming',
      })[0]
    ).toBe(join('C:\\Users\\tomas\\AppData\\Roaming', 'Dripnex'));
    expect(userDataRootCandidates({ platform: 'darwin', home: '/Users/tomas' })[0]).toBe(
      '/Users/tomas/Library/Application Support/Dripnex'
    );
  });

  it('still includes the electron-vite scoped name and legacy lowercase', () => {
    const linux = userDataRootCandidates({ platform: 'linux', home: '/home/tomas' });
    expect(linux).toContain('/home/tomas/.config/@dripnex/desktop');
    expect(linux).toContain('/home/tomas/.config/dripnex');
  });
});

describe('pickUserDataRoot', () => {
  const candidates = [
    '/home/tomas/.config/Dripnex',
    '/home/tomas/.config/@dripnex/desktop',
    '/home/tomas/.config/dripnex',
  ];

  it('prefers the packaged root when it has dripnex.db', () => {
    const exists = (path: string) =>
      path === '/home/tomas/.config/Dripnex/dripnex.db' ||
      path === '/home/tomas/.config/@dripnex/desktop/plugins';
    expect(pickUserDataRoot(candidates, exists)).toBe('/home/tomas/.config/Dripnex');
  });

  it('uses the scoped electron-vite root when only that has plugins', () => {
    const exists = (path: string) => path === '/home/tomas/.config/@dripnex/desktop/plugins';
    expect(pickUserDataRoot(candidates, exists)).toBe('/home/tomas/.config/@dripnex/desktop');
  });

  it('defaults to packaged Dripnex when nothing exists yet', () => {
    expect(pickUserDataRoot(candidates, () => false)).toBe('/home/tomas/.config/Dripnex');
  });
});

describe('resolveUserDataRoot', () => {
  it('honors DRIPNEX_DATA_DIR over candidates', () => {
    expect(
      resolveUserDataRoot(undefined, {
        env: { DRIPNEX_DATA_DIR: '/tmp/explicit' },
        platform: 'linux',
        home: '/home/tomas',
        exists: () => false,
      })
    ).toBe('/tmp/explicit');
  });

  it('honors an explicit override over the env var', () => {
    expect(
      resolveUserDataRoot('/tmp/override', {
        env: { DRIPNEX_DATA_DIR: '/tmp/explicit' },
        platform: 'linux',
        home: '/home/tomas',
        exists: () => false,
      })
    ).toBe('/tmp/override');
  });
});
