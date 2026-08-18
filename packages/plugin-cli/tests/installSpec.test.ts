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

  it('treats a kebab name as a registry slug', () => {
    expect(parseInstallSource('stamp', none)).toEqual({ kind: 'registry', slug: 'stamp' });
    expect(parseInstallSource('stamp@0.1.0', none)).toEqual({
      kind: 'registry',
      slug: 'stamp',
      tag: '0.1.0',
    });
  });
});
