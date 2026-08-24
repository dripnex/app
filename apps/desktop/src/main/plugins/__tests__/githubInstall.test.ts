import { describe, expect, it } from 'vitest';
import {
  isAllowedPluginHost,
  parseConnectSpec,
  pickReleaseTarball,
  uniqueReleaseTags,
} from '../githubInstall';

describe('parseConnectSpec', () => {
  it('parses owner/repo and tag', () => {
    expect(parseConnectSpec('acme/plug')).toEqual({ kind: 'github', owner: 'acme', repo: 'plug' });
    expect(parseConnectSpec('acme/plug@v1.2.3')).toEqual({
      kind: 'github',
      owner: 'acme',
      repo: 'plug',
      tag: 'v1.2.3',
    });
  });

  it('parses a registry slug', () => {
    expect(parseConnectSpec('acme-plug')).toEqual({ kind: 'registry', slug: 'acme-plug' });
    expect(parseConnectSpec('acme-plug@0.1.0')).toEqual({
      kind: 'registry',
      slug: 'acme-plug',
      tag: '0.1.0',
    });
  });

  it('resolves official slugs to the GitHub owner/repo (#562)', () => {
    expect(parseConnectSpec('dripnex-vim-mode')).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'plugin-vim',
    });
    expect(parseConnectSpec('dripnex-vim-mode@1.2.0')).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'plugin-vim',
      tag: '1.2.0',
    });
    expect(parseConnectSpec('mermaid')).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'plugin-mermaid',
    });
    expect(parseConnectSpec('math')).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'plugin-math',
    });
    expect(parseConnectSpec('theme-parchment')).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'theme-parchment',
    });
    expect(parseConnectSpec('theme-harbor-dusk')).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'theme-harbor-dusk',
    });
    expect(parseConnectSpec('dripnex/plugin-vim')).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'plugin-vim',
    });
  });

  it('parses GitHub URLs and rejects anything else', () => {
    expect(parseConnectSpec('https://github.com/acme/plug')).toEqual({
      kind: 'github',
      owner: 'acme',
      repo: 'plug',
    });
    expect(parseConnectSpec('https://evil.example/x.tar.gz')).toEqual({
      error: 'Only GitHub repos or HTTPS release archives',
    });
    expect(parseConnectSpec('not a spec')).toEqual({
      error: 'Spec cannot contain spaces',
    });
  });
});

describe('pickReleaseTarball', () => {
  it('picks the first tar.gz asset', () => {
    expect(
      pickReleaseTarball([
        { name: 'notes.txt', browser_download_url: 'https://x/notes.txt' },
        { name: 'plug-1.0.0.tar.gz', browser_download_url: 'https://x/plug-1.0.0.tar.gz' },
      ])
    ).toBe('https://x/plug-1.0.0.tar.gz');
  });
});

describe('uniqueReleaseTags', () => {
  it('tries v-prefixed and bare tags', () => {
    expect(uniqueReleaseTags('1.0.0')).toEqual(['1.0.0', 'v1.0.0']);
    expect(uniqueReleaseTags('v1.0.0')).toEqual(['v1.0.0', '1.0.0']);
  });
});

describe('isAllowedPluginHost', () => {
  it('allows GitHub and the Dripnex registry hosts', () => {
    expect(isAllowedPluginHost('github.com')).toBe(true);
    expect(isAllowedPluginHost('objects.githubusercontent.com')).toBe(true);
    expect(isAllowedPluginHost('api.dripnex.app')).toBe(true);
    expect(isAllowedPluginHost('readied-api-production.readied.workers.dev')).toBe(true);
    expect(isAllowedPluginHost('evil.example')).toBe(false);
  });
});
