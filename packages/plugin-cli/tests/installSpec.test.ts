import { describe, expect, it } from 'vitest';
import { parseInstallSource } from '../src/installSpec';

const none = () => false;
const all = () => true;

describe('parseInstallSource', () => {
  it('prefers a path that exists', () => {
    expect(parseInstallSource('owner/repo', all)).toEqual({ kind: 'path', path: 'owner/repo' });
  });

  it('parses owner/repo and optional tag', () => {
    expect(parseInstallSource('acme/mermaid-plus', none)).toEqual({
      kind: 'github',
      owner: 'acme',
      repo: 'mermaid-plus',
    });
    expect(parseInstallSource('acme/mermaid-plus@v1.2.3', none)).toEqual({
      kind: 'github',
      owner: 'acme',
      repo: 'mermaid-plus',
      tag: 'v1.2.3',
    });
  });

  it('parses github: prefix and web URLs', () => {
    expect(parseInstallSource('github:acme/plug@2.0.0', none)).toEqual({
      kind: 'github',
      owner: 'acme',
      repo: 'plug',
      tag: '2.0.0',
    });
    expect(parseInstallSource('https://github.com/acme/plug', none)).toEqual({
      kind: 'github',
      owner: 'acme',
      repo: 'plug',
    });
  });

  it('treats a release download URL as a direct archive', () => {
    const url = 'https://github.com/acme/plug/releases/download/v1.0.0/plug-1.0.0.tar.gz';
    expect(parseInstallSource(url, none)).toEqual({ kind: 'url', url });
  });

  it('treats an unknown kebab name as a registry slug', () => {
    expect(parseInstallSource('acme-plug', none)).toEqual({ kind: 'registry', slug: 'acme-plug' });
    expect(parseInstallSource('acme-plug@0.1.0', none)).toEqual({
      kind: 'registry',
      slug: 'acme-plug',
      tag: '0.1.0',
    });
  });

  it('resolves official slugs to the GitHub owner/repo', () => {
    expect(parseInstallSource('dripnex-vim-mode', none)).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'plugin-vim',
    });
    expect(parseInstallSource('dripnex/plugin-vim', none)).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'plugin-vim',
    });
    expect(parseInstallSource('mermaid@0.1.0', none)).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'plugin-mermaid',
      tag: '0.1.0',
    });
    expect(parseInstallSource('theme-parchment', none)).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'theme-parchment',
    });
    expect(parseInstallSource('theme-harbor-dusk', none)).toEqual({
      kind: 'github',
      owner: 'dripnex',
      repo: 'theme-harbor-dusk',
    });
  });
});
